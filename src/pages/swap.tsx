import type { NextPage } from 'next';
import { useEffect, useState } from 'react';
import { useChainId, useSwitchChain, useChains, useAccount } from 'wagmi';
import { swapTokenList } from '../utils/swap_tokenlist';
import { getBalance, readContract, waitForTransactionReceipt } from '@wagmi/core';
import { formatUnits, maxUint256, parseUnits } from 'viem';
import axios from 'axios';
import { config } from '../wagmi';
import { WPLS_ADDRESS, PLS_ADDRESS, WPLS_ABI, Swappie_Router_Address, Swappie_Router_ABI, Erc20_ABI } from '../utils/contractData';
import { useWriteContract } from 'wagmi'
import { useTransactionModal } from '../hooks/useTransactionModal';
import { TransactionModal } from '../components/TransactionModal';
import { backendUrl } from '../utils/config';

interface Token {
    chainId: number;
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    logoURI: string;
}

const Swap: NextPage = () => {
    const chainId = useChainId();
    const chains = useChains();
    const { switchChain } = useSwitchChain();
    const { address, isConnected } = useAccount();
    const [fromToken, setFromToken] = useState<Token | null>(null);
    const [toToken, setToToken] = useState<Token | null>(null);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [slippage, setSlippage] = useState(5);
    const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fromTokenBalance, setFromTokenBalance] = useState('');
    const [toTokenBalance, setToTokenBalance] = useState('');
    const [swapType, setSwapType] = useState<number>(0);
    const { modalState, showPending, showSuccess, showError, closeModal } = useTransactionModal();
    const [path, setPath] = useState<any>(null);
    const [customTokenAddress, setCustomTokenAddress] = useState('');
    const [customTokens, setCustomTokens] = useState<Token[]>([]);
    const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
    const [customTokenError, setCustomTokenError] = useState('');
    const [previewToken, setPreviewToken] = useState<Token | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const pulseChain = chains.find(chain => chain.id === 369);

    const { writeContractAsync } = useWriteContract();

    useEffect(() => {
        if (!isConnected) {
            alert('Please connect your wallet to continue');
            return;
        }
        if (chainId !== 369 && pulseChain && switchChain) {
            switchChain({ chainId: 369 });
        }
    }, [chainId, pulseChain, switchChain, isConnected]);

    useEffect(() => {
        if (swapTokenList.length > 0) {
            setFromToken(swapTokenList[0]); // PLS
            setToToken(swapTokenList[7]); // USDC
        }
    }, []);

    useEffect(() => {
        const fetchBalance = async () => {
            if (address) {
                if (fromToken == null) return;
                if (fromToken.address == PLS_ADDRESS) {
                    const balance = await getBalance(config, {
                        address: address as `0x${string}`,
                        chainId: 369
                        });
                    setFromTokenBalance(balance.formatted);
                }
                else{
                    const balance = await getBalance(config, {
                        address: address as `0x${string}`,
                        token: fromToken.address as `0x${string}`,
                        chainId: 369
                    });
                    setFromTokenBalance(balance.formatted);
                }
                if (toToken == null) return;
                if (toToken.address == PLS_ADDRESS) {
                    const balance = await getBalance(config, {
                        address: address as `0x${string}`,
                        chainId: 369
                    });
                    setToTokenBalance(balance.formatted);
                }
                else{
                    const balance = await getBalance(config, {
                        address: address as `0x${string}`,
                        token: toToken.address as `0x${string}`,
                        chainId: 369
                    });
                    setToTokenBalance(balance.formatted);
                }
            }
        };
        fetchBalance();
    }, [fromToken, toToken, address, fromAmount, toAmount]);

    useEffect(() => {
        if (fromToken?.address == PLS_ADDRESS && toToken?.address == WPLS_ADDRESS){
            setSwapType(0); // Wrap
            return;
        }
        if (fromToken?.address == WPLS_ADDRESS && toToken?.address == PLS_ADDRESS){
            setSwapType(1); // Unwrap
            return;
        }
        if (fromToken?.address == PLS_ADDRESS){
            setSwapType(2); // swapExactETHForTokens
            return;
        }
        if (toToken?.address == PLS_ADDRESS){
            setSwapType(3); // swapExactTokensForETH
            return;
        }
        else{
            setSwapType(4); // swapExactTokensForTokens
            return;
        }
    }, [fromToken, toToken, isLoading]);

    const isValidAddress = (address: string): boolean => {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    };

    const fetchTokenInfo = async (tokenAddress: string): Promise<Token | null> => {
        try {
            const [name, symbol, decimals] = await Promise.all([
                readContract(config, {
                    address: tokenAddress as `0x${string}`,
                    abi: Erc20_ABI,
                    functionName: 'name',
                    chainId: 369
                }),
                readContract(config, {
                    address: tokenAddress as `0x${string}`,
                    abi: Erc20_ABI,
                    functionName: 'symbol',
                    chainId: 369
                }),
                readContract(config, {
                    address: tokenAddress as `0x${string}`,
                    abi: Erc20_ABI,
                    functionName: 'decimals',
                    chainId: 369
                })
            ]);

            return {
                chainId: 369,
                name: name as string,
                address: tokenAddress,
                symbol: symbol as string,
                decimals: decimals as number,
                logoURI: `https://dummyimage.com/64x64/cccccc/000000&text=${(symbol as string).slice(0, 2)}`
            };
        } catch (error) {
            console.error('Error fetching token info:', error);
            return null;
        }
    };

    const previewTokenInfo = async (tokenAddress: string) => {
        if (!tokenAddress.trim() || !isValidAddress(tokenAddress)) {
            setPreviewToken(null);
            return;
        }

        const allTokens = [...swapTokenList, ...customTokens];
        const existingToken = allTokens.find(token => 
            token.address.toLowerCase() === tokenAddress.toLowerCase()
        );

        if (existingToken) {
            setPreviewToken(existingToken);
            return;
        }

        setIsPreviewLoading(true);
        setCustomTokenError('');

        try {
            const tokenInfo = await fetchTokenInfo(tokenAddress);
            if (tokenInfo) {
                setPreviewToken(tokenInfo);
            } else {
                setPreviewToken(null);
                setCustomTokenError('Failed to fetch token information');
            }
        } catch (error) {
            setPreviewToken(null);
            setCustomTokenError('Error fetching token information');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const addCustomToken = async () => {
        if (!customTokenAddress.trim()) {
            setCustomTokenError('Please enter a token address');
            return;
        }

        if (!isValidAddress(customTokenAddress)) {
            setCustomTokenError('Invalid token address format');
            return;
        }

        const allTokens = [...swapTokenList, ...customTokens];
        const existingToken = allTokens.find(token => 
            token.address.toLowerCase() === customTokenAddress.toLowerCase()
        );

        if (existingToken) {
            if (showTokenSelector === 'from') {
                setFromToken(existingToken);
                if (toToken?.address === existingToken.address) {
                    setToToken(fromToken);
                }
            } else {
                setToToken(existingToken);
                if (fromToken?.address === existingToken.address) {
                    setFromToken(toToken);
                }
            }
            setShowTokenSelector(null);
            setCustomTokenAddress('');
            setPreviewToken(null);
            setCustomTokenError('');
            return;
        }

        setIsLoadingCustomToken(true);
        setCustomTokenError('');

        try {
            const tokenInfo = await fetchTokenInfo(customTokenAddress);
            
            if (tokenInfo) {
                setCustomTokens(prev => [...prev, tokenInfo]);
                
                if (showTokenSelector === 'from') {
                    setFromToken(tokenInfo);
                    if (toToken?.address === tokenInfo.address) {
                        setToToken(fromToken);
                    }
                } else {
                    setToToken(tokenInfo);
                    if (fromToken?.address === tokenInfo.address) {
                        setFromToken(toToken);
                    }
                }
                
                setShowTokenSelector(null);
                setCustomTokenAddress('');
                setPreviewToken(null);
                setCustomTokenError('');
            } else {
                setCustomTokenError('Failed to fetch token information. Please check the address.');
            }
        } catch (error) {
            setCustomTokenError('Error fetching token information');
        } finally {
            setIsLoadingCustomToken(false);
        }
    };

    const allAvailableTokens = [...swapTokenList, ...customTokens];

    const filteredTokens = allAvailableTokens.filter(token => {
        const searchLower = searchTerm.toLowerCase();
        return (
            token.name.toLowerCase().includes(searchLower) ||
            token.symbol.toLowerCase().includes(searchLower) ||
            token.address.toLowerCase().includes(searchLower)
        );
    });

    const TokenSelector = ({ type }: { type: 'from' | 'to' }) => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-2xl p-6 w-96 max-h-[80vh] overflow-hidden shadow-2xl border border-slate-600 flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-xl font-semibold text-white">Select Token</h3>
                    <button
                        onClick={() => {
                            setShowTokenSelector(null);
                            setCustomTokenAddress('');
                            setPreviewToken(null);
                            setCustomTokenError('');
                        }}
                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-shrink-0 mb-4">
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            placeholder="Enter custom token address..."
                            value={customTokenAddress}
                            onChange={(e) => {
                                const value = e.target.value;
                                setCustomTokenAddress(value);
                                setCustomTokenError('');
                                if (value.trim()) {
                                    previewTokenInfo(value);
                                } else {
                                    setPreviewToken(null);
                                }
                            }}
                            className="flex-1 p-3 bg-slate-700 rounded-lg text-white placeholder-gray-400 border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
                        />
                        <button
                            onClick={addCustomToken}
                            disabled={isLoadingCustomToken || !customTokenAddress.trim() || !previewToken}
                            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                                isLoadingCustomToken || !customTokenAddress.trim() || !previewToken
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {isLoadingCustomToken ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                                'Add'
                            )}
                        </button>
                    </div>
                    
                    {isPreviewLoading && (
                        <div className="flex items-center gap-2 p-3 bg-slate-700 rounded-lg mb-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="text-gray-300">Loading token info...</span>
                        </div>
                    )}
                    
                    {previewToken && !isPreviewLoading && (
                        <div className="flex items-center gap-3 p-3 bg-slate-700 rounded-lg mb-2 border border-green-500">
                            <img
                                src={previewToken.logoURI}
                                alt={previewToken.symbol}
                                className="w-8 h-8 rounded-full flex-shrink-0"
                                onError={(e) => {
                                    e.currentTarget.src = 'https://dummyimage.com/64x64/cccccc/000000&text=?';
                                }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">{previewToken.symbol}</div>
                                <div className="text-gray-400 text-sm truncate">{previewToken.name}</div>
                                <div className="text-gray-500 text-xs truncate">{previewToken.address}</div>
                            </div>
                            <div className="text-green-400 text-sm font-medium">Ready to add</div>
                        </div>
                    )}
                    
                    {customTokenError && (
                        <div className="text-red-400 text-sm mb-2">{customTokenError}</div>
                    )}
                </div>

                <div className="flex-shrink-0 mb-4">
                    <input
                        type="text"
                        placeholder="Search by name, symbol, or address..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 bg-slate-700 rounded-lg text-white placeholder-gray-400 border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                    {filteredTokens.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p>No tokens found</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredTokens.map((token) => (
                                <div
                                    key={token.address}
                                    onClick={() => {
                                        setFromAmount('');
                                        setToAmount('');
                                        if (type === 'from') {
                                            setFromToken(token);
                                            if (toToken?.address === token.address) {
                                                setToToken(fromToken);
                                            }
                                        } else {
                                            setToToken(token);
                                            if (fromToken?.address === token.address) {
                                                setFromToken(toToken);
                                            }
                                        }
                                        setShowTokenSelector(null);
                                        setSearchTerm('');
                                        setCustomTokenAddress('');
                                        setPreviewToken(null);
                                        setCustomTokenError('');
                                    }}
                                    className="flex items-center p-3 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-600"
                                >
                                    <img
                                        src={token.logoURI}
                                        alt={token.symbol}
                                        className="w-8 h-8 rounded-full mr-3 flex-shrink-0"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://dummyimage.com/64x64/cccccc/000000&text=?';
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">{token.symbol}</div>
                                        <div className="text-gray-400 text-sm truncate">{token.name}</div>
                                        <div className="text-gray-500 text-xs truncate">{token.address}</div>
                                    </div>
                                    {(fromToken?.address === token.address || toToken?.address === token.address) && (
                                        <div className="ml-2 text-blue-500 flex-shrink-0">
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const handleFromAmountChange = (value: string) => {
        if (isNaN(Number(value)) || value == ''){
            setToAmount('');
        }
        setFromAmount(value);
    };

    const handleSwap = async () => {
        if (swapType == 0){
            await wrap();
        }
        else if (swapType == 1){
            await unwrap();
        }
        else if (swapType == 2){
            await swapExactETHForTokens();
        }
        else if (swapType == 3){
            await approveTokens();
            await swapExactTokensForETH();
        }
        else if (swapType == 4){
            await approveTokens();
            await swapExactTokensForTokens();
        }
    }

    const wrap = async () => {
        setIsLoading(true);
        try {
            showPending('Wrapping PLS');
            
            const hash = await writeContractAsync({
                address: WPLS_ADDRESS,
                abi: WPLS_ABI,
                functionName: 'deposit',
                chainId: 369,
                value: parseUnits(fromAmount, fromToken?.decimals ?? 0)
            });
            
            const receipt = await waitForTransactionReceipt(config, {
                hash: hash,
                chainId: 369
            });
            
            if (receipt.status === 'success') {
                showSuccess(hash, 'PLS wrapped successfully!');
            } 
        } catch (error) {
            showError('Transaction failed');
        } finally {
            setIsLoading(false);
            setFromAmount('');
            setToAmount('');
        }
    }

    const unwrap = async () => {
        setIsLoading(true);
        try {
            showPending('Unwrapping PLS');
            
            const hash = await writeContractAsync({
                address: WPLS_ADDRESS,
                abi: WPLS_ABI,
                functionName: 'withdraw',
                chainId: 369,
                args: [parseUnits(fromAmount, fromToken?.decimals ?? 0)]
            });
            
            const receipt = await waitForTransactionReceipt(config, {
                hash: hash,
                chainId: 369
            });
            
            if (receipt.status === 'success') {
                showSuccess(hash, 'PLS unwrapped successfully!');
            } 
        } catch (error) {
            showError('Transaction failed');
        } finally {
            setIsLoading(false);
            setFromAmount('');
            setToAmount('');
        }
    }

    const swapExactETHForTokens = async () => {
        setIsLoading(true);
        try {
            showPending(`Swapping PLS into ${toToken?.symbol}`);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 - slippagePercent) * 1000));
            const amount = parseUnits(toAmount, toToken?.decimals ?? 0);
            const amountOutMin = (amount * slippageFactor) / BigInt(1000);

            console.log(amountOutMin);

            const hash = await writeContractAsync({
                address: Swappie_Router_Address,
                abi: Swappie_Router_ABI,
                functionName: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
                chainId: 369,
                value: parseUnits(fromAmount, 18),
                args: [amountOutMin, path, address, deadline]
            });

            const receipt = await waitForTransactionReceipt(config, {
                hash: hash,
                chainId: 369
            });
            
            if (receipt.status === 'success') {
                showSuccess(hash, 'Swap successful!');
            } 
        } catch (error) {
            showError('Transaction failed');
        } finally {
            setIsLoading(false);
            setFromAmount('');
            setToAmount('');
        }
    }

    const swapExactTokensForETH = async () => {
        setIsLoading(true);
        try {
            showPending(`Swapping ${fromToken?.symbol} into PLS`);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 - slippagePercent) * 1000));
            const amount = parseUnits(toAmount, toToken?.decimals ?? 0);
            const amountOutMin = (amount * slippageFactor) / BigInt(1000);

            const hash = await writeContractAsync({
                address: Swappie_Router_Address,
                abi: Swappie_Router_ABI,
                functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
                chainId: 369,
                args: [parseUnits(fromAmount, fromToken?.decimals ?? 0), amountOutMin, path, address, deadline]
            });

            const receipt = await waitForTransactionReceipt(config, {
                hash: hash,
                chainId: 369
            });
            
            if (receipt.status === 'success') {
                showSuccess(hash, 'Swap successful!');
            } 
        } catch (error) {
            showError('Transaction failed');
        } finally {
            setIsLoading(false);
            setFromAmount('');
            setToAmount('');
        }
    }

    const swapExactTokensForTokens = async () => {
        setIsLoading(true);
        try {
            showPending(`Swapping ${fromToken?.symbol} into ${toToken?.symbol}`);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 - slippagePercent) * 1000));
            const amount = parseUnits(toAmount, toToken?.decimals ?? 0);
            const amountOutMin = (amount * slippageFactor) / BigInt(1000);
            
            const hash = await writeContractAsync({
                address: Swappie_Router_Address,
                abi: Swappie_Router_ABI,
                functionName: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
                chainId: 369,
                args: [parseUnits(fromAmount, fromToken?.decimals ?? 0), amountOutMin, path, address, deadline]
            });

            const receipt = await waitForTransactionReceipt(config, {
                hash: hash,
                chainId: 369
            });
            
            if (receipt.status === 'success') {
                showSuccess(hash, 'Swap successful!');
            } 
        } catch (error) {
            showError('Transaction failed');
        } finally {
            setIsLoading(false);
            setFromAmount('');
            setToAmount('');
        }
    }

    const approveTokens = async () => {
        if (!fromToken || !address) return;

        const allowance = await readContract(config, {
            address: fromToken.address as `0x${string}`,
            abi: Erc20_ABI,
            functionName: 'allowance',
            args: [
                address,                // owner (user's address)
                Swappie_Router_Address   // spender (router)
            ],
            chainId: 369
        });

        const amountToApprove = parseUnits(fromAmount, fromToken.decimals);

        if (BigInt(allowance as string) >= amountToApprove) {
            return;
        }

        try {
            showPending('Approve token spending');

            const txHash = await writeContractAsync({
                address: fromToken.address as `0x${string}`,
                abi: Erc20_ABI,
                functionName: 'approve',
                args: [
                    Swappie_Router_Address,
                    maxUint256
                ],
                chainId: 369
            });

            const receipt = await waitForTransactionReceipt(config, {
                hash: txHash,
                chainId: 369
            });

            if (receipt.status === 'success') {
                showSuccess(txHash, 'Approval successful!');
            } else {
                showError('Approval failed');
            }
        } catch (error) {
            showError('Approval transaction failed');
            console.error(error);
        }
    };

    const debounceTimeout = 1000; // ms

    useEffect(() => {

        if (swapType === 0 || swapType === 1) {
            setToAmount(fromAmount ? fromAmount : '');
            return;
        }

        const handler = setTimeout(() => {
            let fromTokenAddress = fromToken?.address === PLS_ADDRESS ? WPLS_ADDRESS : fromToken?.address;
            let toTokenAddress = toToken?.address === PLS_ADDRESS ? WPLS_ADDRESS : toToken?.address;

            if (fromAmount && !isNaN(Number(fromAmount)) && fromToken?.decimals && Number(fromAmount) > 0) {
                setIsLoading(true);
                axios.post(`${backendUrl}/api/trading/find-path`, {
                    fromToken: fromTokenAddress,
                    toToken: toTokenAddress,
                    amount: parseUnits(fromAmount, fromToken?.decimals).toString()
                }).then(res => {
                    console.log(res.data);
                    setPath(res.data.path);
                    setToAmount(formatUnits(res.data.amount, toToken?.decimals ?? 0));
                }).catch(err => {
                    console.log(err);
                }).finally(() => {
                    setIsLoading(false);
                });
            }
        }, debounceTimeout);

        return () => clearTimeout(handler);
    }, [
        fromAmount,
        fromToken,
        toToken,
        swapType
    ]);


    return (
        <div className="container mx-auto px-4 py-20">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">
                        Swap Tokens
                    </h1>
                    <p className="text-gray-300">
                        Exchange tokens instantly on PulseChain with the best rates
                    </p>
                </div>

                {/* Swap Card */}
                <div className="max-w-md mx-auto">
                    <div className="glass rounded-2xl p-6 border border-slate-600">
                        {/* From Token */}
                        <div className="p-4 rounded-xl bg-slate-800 border border-slate-600 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400 text-sm">You pay</span>
                                <span className="text-gray-400 text-sm">Balance: {fromToken?.address ? parseFloat(parseFloat(fromTokenBalance).toFixed(4)) + " " + fromToken?.symbol : ""}</span>
                            </div>
                            <div className="flex flex-col min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 min-w-0">
                                    <input
                                        type="number"
                                        value={fromAmount}
                                        onChange={e => {
                                            handleFromAmountChange(e.target.value);
                                        }}
                                        disabled = {isLoading}
                                        placeholder="0.0"
                                        className="flex-1 min-w-0 bg-transparent text-2xl font-bold text-white outline-none appearance-textfield
                                            [&::-webkit-outer-spin-button]:appearance-none
                                            [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        onClick={() => setShowTokenSelector('from')}
                                        className="flex items-center bg-slate-600 hover:bg-slate-500 rounded-lg px-3 py-2 transition-colors max-w-[200px] overflow-hidden cursor-pointer"
                                        type="button"
                                    >
                                        <img src={fromToken?.logoURI} alt={fromToken?.symbol} className="w-6 h-6 rounded-full mr-2 flex-shrink-0" />
                                        <span className="text-white font-medium truncate">{fromToken?.symbol}</span>
                                        <svg className="w-4 h-4 ml-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex justify-end gap-2 mt-1">
                                    {[0.25, 0.5, 0.75, 1].map((percent, idx) => (
                                        <button
                                            key={percent}
                                            onClick={() => {
                                                let value = (parseFloat(fromTokenBalance) * percent).toString();
                                                if (percent === 1){
                                                    value = fromTokenBalance;
                                                }
                                                handleFromAmountChange(value);
                                            }}
                                            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                                            type="button"
                                        >
                                            {percent === 1 ? 'Max' : `${percent * 100}%`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Swap Direction Button */}
                        <div className="flex justify-center my-4">
                            <button
                                onClick={() => {
                                    const tempToken = fromToken;
                                    setFromToken(toToken);
                                    setToToken(tempToken);
                                    setFromAmount('');
                                    setToAmount('');
                                }}
                                className="bg-slate-600 hover:bg-slate-500 rounded-full p-2 transition-colors cursor-pointer"
                            >
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                            </button>
                        </div>

                        {/* To Token */}
                        <div className="p-4 rounded-xl bg-slate-700 border border-slate-600">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400 text-sm">You receive</span>
                                <span className="text-gray-400 text-sm">Balance: {toToken?.address ? parseFloat(parseFloat(toTokenBalance).toFixed(4)) + " " + toToken?.symbol : ""}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                                <input
                                    type="number"
                                    value={toAmount}
                                    disabled = {true}
                                    placeholder="0.0"
                                    className="flex-1 min-w-0 bg-transparent text-2xl font-bold text-white outline-none appearance-textfield
                                        [&::-webkit-outer-spin-button]:appearance-none
                                        [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                    onClick={() => setShowTokenSelector('to')}
                                    className="flex items-center bg-slate-600 hover:bg-slate-500 rounded-lg px-3 py-2 transition-colors max-w-[200px] overflow-hidden cursor-pointer"
                                    type="button"
                                >
                                    <img src={toToken?.logoURI} alt={toToken?.symbol} className="w-6 h-6 rounded-full mr-2 flex-shrink-0" />
                                    <span className="text-white font-medium truncate">{toToken?.symbol}</span>
                                    <svg className="w-4 h-4 ml-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Swap Button */}
                        <button
                            onClick={handleSwap}
                            disabled={!fromToken || !toToken || !fromAmount || !toAmount || !isConnected || isLoading || parseFloat(fromAmount) <= 0 || parseFloat(toAmount) <= 0 || parseFloat(fromAmount) > parseFloat(fromTokenBalance)}
                            className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all cursor-pointer ${
                                !fromToken || !toToken || !fromAmount || !toAmount || !isConnected || isLoading || parseFloat(fromAmount) <= 0 || parseFloat(toAmount) <= 0 || parseFloat(fromAmount) > parseFloat(fromTokenBalance)
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white pulse-glow'
                            }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Loading...
                                </div>
                            ) : !isConnected ? (
                                'Connect Wallet'
                            ) : !fromToken || !toToken ? (
                                'Select Tokens'
                            ) : !fromAmount || parseFloat(fromAmount) <= 0 || parseFloat(toAmount) <= 0 ? (
                                'Enter Amount'
                            ) : (parseFloat(fromAmount) > parseFloat(fromTokenBalance)) ? (
                                'Insufficient Balance'
                            ) : swapType == 0 ? (
                                'Wrap'
                            ) : swapType == 1 ? (
                                'Unwrap'
                            ) : 'Swap'
                            }
                        </button>

                        {/* Slippage Settings */}
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400 text-sm">Slippage Tolerance</span>
                                <span className="text-white text-sm">{slippage}%</span>
                            </div>
                            <div className="flex gap-2">
                                {[1, 5, 10, 20, 50].map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setSlippage(value)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                            slippage === value
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                                        }`}
                                    >
                                        {value}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Token Selector Modal */}
                {showTokenSelector && <TokenSelector type={showTokenSelector} />}
            </div>
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

export default Swap;
