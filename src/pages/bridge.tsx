import type { NextPage } from 'next';
import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { etherTokens } from '../utils/etherTokens';
import { useChainId, useSwitchChain, useChains, useAccount } from 'wagmi';
import { config } from '../wagmi';
import { getBalance, readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { pulseChainOmnibridgeEddress, swappieBridgeAddress, Swappie_Bridge_ABI, ETH_ADDRESS, Erc20_ABI } from '../utils/contractData';
import { useTransactionModal } from '../hooks/useTransactionModal';
import { TransactionModal } from '../components/TransactionModal';
import { parseUnits, maxUint256 } from 'viem';

const EtherToPulse: NextPage = () => {
    const [selectedToken, setSelectedToken] = useState(etherTokens[0]);
    const [amount, setAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [availableBalance, setAvailableBalance] = useState('');
    const [decimals, setDecimals] = useState(0);
    const [minPerTx, setMinPerTx] = useState(0);
    const [platformFee, setPlatformFee] = useState(0);

    const chainId = useChainId();
    const chains = useChains();
    const { switchChain } = useSwitchChain();
    const { address, isConnected } = useAccount();
    const { modalState, showPending, showSuccess, showError, closeModal } = useTransactionModal();
    
    // Find Ethereum Mainnet in your supported chains
    const etherMainnet = chains.find(chain => chain.id === 1);

    const getPlatformFee = async () => {

        const platformFee = await readContract(config, {
            address: swappieBridgeAddress as `0x${string}`,
            abi: Swappie_Bridge_ABI,
            functionName: 'platformFee',
            chainId: 1
        });

        setPlatformFee(Number(platformFee));
    }

    useEffect(() => {
        getPlatformFee();
    }, []);

    useEffect(() => {
        if (!isConnected) {
            alert('Please connect your wallet to continue');
            return;
        }
        // If not on Ethereum Mainnet, prompt to switch
        if (chainId !== 1 && etherMainnet && switchChain) {
            switchChain({ chainId: 1 });
        }
    }, [chainId, etherMainnet, switchChain, isConnected]);

    // Extract fetchBalance function so it can be called from handleBridge
    const fetchBalance = useCallback(async () => {
        if (address) {
            let tokenAddress = selectedToken.address;
            let decimal = 18;
            if (selectedToken.symbol == 'ETH') {
                const balance = await getBalance(config, {
                    address: address as `0x${string}`,
                    chainId: 1
                    });
                setAvailableBalance(balance.formatted);
                setDecimals(balance.decimals);

                tokenAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
            }
            else{
                const balance = await getBalance(config, {
                    address: address as `0x${string}`,
                    token: selectedToken.address as `0x${string}`,
                    chainId: 1
                });
                setAvailableBalance(balance.formatted);
                setDecimals(balance.decimals);

                decimal = balance.decimals;
            }

            const minPerTx = await readContract(config, {
                address: pulseChainOmnibridgeEddress as `0x${string}`,
                abi: [
                    {
                        inputs: [
                            {
                                internalType: 'address',
                                name: '_token',
                                type: 'address'
                            }
                        ],
                        name: 'minPerTx',
                        outputs: [
                            {
                                 internalType: 'uint256',
                                 name: '',
                                 type: 'uint256'
                            }
                        ],
                        stateMutability: 'view',
                        type: 'function'
                    }
                ],
                functionName: 'minPerTx',
                chainId: 1,
                args: [tokenAddress as `0x${string}`]
            });
            
            setMinPerTx(Math.ceil(Number(minPerTx) / Number(10 ** decimal) * 100 / (100 - 0.25) *10000)/10000);
        }
    }, [address, selectedToken]); // Add dependencies

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]); // Now fetchBalance is properly memoized

    const handleBridge = async () => {
        if (!amount || parseFloat(amount) <= 0) return;
        
        setIsProcessing(true);
        
        try {
            if (selectedToken.address === ETH_ADDRESS) {
                // Bridge ETH
                showPending('Bridging ETH to Pulse...');
                
                const hash = await writeContract(config, {
                    address: swappieBridgeAddress as `0x${string}`,
                    abi: Swappie_Bridge_ABI,
                    functionName: 'bridgeETH',
                    chainId: 1,
                    value: parseUnits(amount, decimals)
                });
                
                const receipt = await waitForTransactionReceipt(config, {
                    hash: hash,
                    chainId: 1
                });
                
                if (receipt.status === 'success') {
                    showSuccess(hash, 'ETH bridged successfully! Please wait for the transaction to be confirmed.');
                    // Refresh balance after successful bridge
                    await fetchBalance();
                } else {
                    showError('Bridge transaction failed');
                }
            } else {
                // For ERC20 tokens, first check allowance and approve if needed
                const requiredAmount = parseUnits(amount, decimals);
                
                // Check current allowance
                const currentAllowance = await readContract(config, {
                    address: selectedToken.address as `0x${string}`,
                    abi: Erc20_ABI,
                    functionName: 'allowance',
                    chainId: 1,
                    args: [address as `0x${string}`, swappieBridgeAddress as `0x${string}`]
                });
                
                // If allowance is insufficient, approve first
                if (BigInt(currentAllowance as string) < requiredAmount) {
                    showPending(`Approving ${selectedToken.symbol}...`);
                    
                    try {
                        const approveHash = await writeContract(config, {
                            address: selectedToken.address as `0x${string}`,
                            abi: Erc20_ABI,
                            functionName: 'approve',
                            chainId: 1,
                            args: [
                                swappieBridgeAddress as `0x${string}`,
                                maxUint256
                            ]
                        });
                        
                        const approveReceipt = await waitForTransactionReceipt(config, {
                            hash: approveHash,
                            chainId: 1
                        });
                        
                        if (approveReceipt.status === 'success') {
                            showSuccess(approveHash, 'Approval transaction successful!');
                            setIsProcessing(false);
                            return; // Exit here after successful approval
                        } else {
                            showError('Approval transaction failed');
                            setIsProcessing(false);
                            return;
                        }
                    } catch (approveError) {
                        // Check if user rejected the approval
                        if (approveError instanceof Error && approveError.message.includes('User rejected')) {
                            showError('Approval was cancelled by user');
                        } else {
                            showError('Approval transaction failed. Please try again.');
                        }
                        setIsProcessing(false);
                        return;
                    }
                }
                
                // Now bridge the tokens
                showPending(`Bridging ${selectedToken.symbol} to Pulse...`);
                
                const hash = await writeContract(config, {
                    address: swappieBridgeAddress as `0x${string}`,
                    abi: Swappie_Bridge_ABI,
                    functionName: 'bridgeTokens',
                    chainId: 1,
                    args: [
                        selectedToken.address as `0x${string}`,
                        requiredAmount
                    ]
                });
                
                const receipt = await waitForTransactionReceipt(config, {
                    hash: hash,
                    chainId: 1
                });
                
                if (receipt.status === 'success') {
                    showSuccess(hash, `${selectedToken.symbol} bridged successfully! Please wait for the transaction to be confirmed.`);
                    // Refresh balance after successful bridge
                    await fetchBalance();
                } else {
                    showError('Bridge transaction failed');
                }
            }
            
            // Reset form on success
            setAmount('');
            
        } catch (error) {
            console.error('Bridge error:', error);
            
            // Check if user rejected the transaction
            if (error instanceof Error && error.message.includes('User rejected')) {
                showError('Transaction was cancelled by user');
            } else {
                showError('Bridge transaction failed. Please try again.');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredTokens = etherTokens.filter(token =>
        token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate bridge amount and fee
    const bridgeCalculations = useMemo(() => {
        const inputAmount = parseFloat(amount) || 0;
        const fee = inputAmount * platformFee/10000;
        const bridgeAmount = inputAmount - fee;
        
        return {
            inputAmount,
            fee,
            bridgeAmount,
            feeRate: platformFee/100
        };
    }, [amount, platformFee]);

    const handleModalClose = () => {
        setShowTokenModal(false);
        setSearchTerm('');
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleModalClose();
        }
    };

    return (
        <div className="container mx-auto px-4 py-20">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold gradient-text mb-4">
                        Bridge to Pulse
                    </h1>
                    <p className="text-xl text-gray-300">
                        Transfer your assets from Ethereum to Pulse network
                    </p>
                </div>

                {/* Bridge Direction Indicator */}
                <div className="glass p-6 rounded-2xl border border-gray-700/30 mb-8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold">{selectedToken.symbol}</span>
                            </div>
                            <div>
                                <div className="text-white font-semibold">Ethereum</div>
                                <div className="text-sm text-gray-400">Source Network</div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div>
                                <div className="text-white font-semibold text-right">Pulse</div>
                                <div className="text-sm text-gray-400 text-right">Destination Network</div>
                            </div>
                            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold">{selectedToken.symbol == 'ETH' ? 'WETH' : selectedToken.symbol}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bridge Form */}
                <div className="glass p-8 rounded-2xl border border-gray-700/30 mb-8">
                    <div className="space-y-6">
                        {/* Token Selection & Amount Input */}
                        <div>
                            <label className="block text-white font-medium mb-3">
                                Token to Bridge
                            </label>
                            
                            {/* Token Selector Button */}
                            <button
                                onClick={() => setShowTokenModal(true)}
                                className="w-full flex items-center justify-between p-4 bg-gray-800/50 border border-gray-600 rounded-xl hover:border-blue-500 transition-colors cursor-pointer"
                            >
                                <div className="flex items-center space-x-3">
                                    <Image 
                                        src={selectedToken.image} 
                                        alt={selectedToken.symbol} 
                                        width={32}
                                        height={32}
                                        className="w-8 h-8 rounded-full"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/32x32/6b7280/ffffff?text=' + selectedToken.symbol.charAt(0);
                                        }}
                                    />
                                    <div className="text-left">
                                        <div className="text-white font-semibold">{selectedToken.symbol}</div>
                                        <div className="text-sm text-gray-400">{selectedToken.name}</div>
                                    </div>
                                </div>
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <label className="block text-white font-medium mb-3 mt-6">
                                Amount to Bridge
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full bg-gray-800/50 border border-gray-600 rounded-xl px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                    <button className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer" onClick={() => setAmount(availableBalance)}>
                                        MAX
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400 mt-2">
                                <span>Available: {availableBalance} {selectedToken.symbol}</span>
                                <span>Fee: {bridgeCalculations.feeRate}%</span>
                            </div>
                        </div>

                        {/* Bridge Amount Calculation */}
                        {amount && parseFloat(amount) > 0 && (
                            <div className="glass p-4 rounded-xl border border-gray-600">
                                <h4 className="text-white font-medium mb-3">Bridge Summary</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Amount to Bridge:</span>
                                        <span className="text-white">{bridgeCalculations.inputAmount.toFixed(6)} {selectedToken.symbol}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Bridge Fee ({bridgeCalculations.feeRate}%):</span>
                                        <span className="text-red-400">-{bridgeCalculations.fee.toFixed(6)} {selectedToken.symbol}</span>
                                    </div>
                                    <div className="border-t border-gray-600 pt-2 mt-2">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-medium">You will receive:</span>
                                            <span className="text-green-400 font-bold">{bridgeCalculations.bridgeAmount.toFixed(6)} {selectedToken.symbol == 'ETH' ? 'WETH' : selectedToken.symbol}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bridge Button */}
                        <button
                            onClick={handleBridge}
                            disabled={!amount || parseFloat(amount) <= 0 || isProcessing || Number(amount) > Number(availableBalance) || !isConnected || Number(amount) < minPerTx}
                            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                        >
                            {isProcessing ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                    Processing Bridge...
                                </div>
                            ) : (Number(amount) > Number(availableBalance)) ? (
                                <div className="flex items-center justify-center">
                                    Insufficient {selectedToken.symbol} balance
                                </div>
                            ) : !isConnected ? (
                                <div className="flex items-center justify-center">
                                    Connect your wallet to continue
                                </div>
                            ) : (Number(amount) < minPerTx) ? (
                                <div className="flex items-center justify-center">
                                    Minimum amount to bridge is {minPerTx} {selectedToken.symbol}
                                </div>
                            ) : (
                                `Bridge ${selectedToken.symbol} to Pulse`
                            )}
                        </button>
                    </div>
                </div>
                <div className="glass p-8 rounded-2xl border border-gray-700/30">
                    <div className="flex justify-between">
                        <span className="text-gray-400">Min Per Tx:</span>
                        <span className="text-white">{ minPerTx} {selectedToken.symbol}</span>
                    </div>
                </div>
            </div>

            {/* Token Selection Modal */}
            {showTokenModal && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={handleBackdropClick}
                >
                    <div className="glass max-w-md w-full rounded-2xl border border-gray-700/30 max-h-[80vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-700/30">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-white">Select Token</h3>
                                <button
                                    onClick={handleModalClose}
                                    className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Search Input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search tokens..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-gray-800/50 border border-gray-600 rounded-xl px-4 py-3 pl-10 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>

                        {/* Token List */}
                        <div className="overflow-y-auto max-h-[60vh]">
                            {filteredTokens.map((token) => (
                                <button
                                    key={token.symbol}
                                    onClick={() => {
                                        setSelectedToken(token);
                                        handleModalClose();
                                    }}
                                    className="w-full flex items-center space-x-3 p-4 hover:bg-gray-800/50 transition-colors border-b border-gray-700/30 last:border-b-0 cursor-pointer"
                                >
                                    <Image 
                                        src={token.image} 
                                        alt={token.symbol} 
                                        width={40}
                                        height={40}
                                        className="w-10 h-10 rounded-full"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/40x40/6b7280/ffffff?text=' + token.symbol.charAt(0);
                                        }}
                                    />
                                    <div className="flex-1 text-left">
                                        <div className="text-white font-semibold">{token.symbol}</div>
                                        <div className="text-sm text-gray-400">{token.name}</div>
                                    </div>
                                    {selectedToken.symbol === token.symbol && (
                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Add TransactionModal at the end */}
            <TransactionModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                status={modalState.status}
                hash={modalState.hash}
                message={modalState.message}
            />
        </div>
    );
};

export default EtherToPulse; 