import type { NextPage } from 'next';
import { useEffect, useState, useRef } from 'react';
import { useChainId, useSwitchChain, useChains, useAccount } from 'wagmi';
import { swapTokenList } from '../utils/swap_tokenlist';
import { getBalance, readContract, waitForTransactionReceipt } from '@wagmi/core';
import { formatUnits, maxUint256, parseUnits } from 'viem';
import axios from 'axios';
import { config } from '../wagmi';
import { WPLS_ADDRESS, WPLS_ABI, PulseX_Router_Address, PulseX_Router_ABI, Erc20_ABI } from '../utils/contractData';
import { useWriteContract } from 'wagmi'
import { useTransactionModal } from '../hooks/useTransactionModal';
import { TransactionModal } from '../components/TransactionModal';

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
    const [slippage, setSlippage] = useState(0.5);
    const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastChanged, setLastChanged] = useState<'from' | 'to'>('from');
    const [fromTokenBalance, setFromTokenBalance] = useState('');
    const [toTokenBalance, setToTokenBalance] = useState('');
    const [swapType, setSwapType] = useState<number>(0);
    const { modalState, showPending, showSuccess, showError, closeModal } = useTransactionModal();
    const [path, setPath] = useState<any>(null);

    const isProgrammaticUpdate = useRef(false);

    // Find PulseChain in your supported chains
    const pulseChain = chains.find(chain => chain.id === 369);

    const { writeContractAsync } = useWriteContract();

    useEffect(() => {
        if (!isConnected) {
            alert('Please connect your wallet to continue');
            return;
        }
        // If not on PulseChain, prompt to switch
        if (chainId !== 369 && pulseChain && switchChain) {
            switchChain({ chainId: 369 });
        }
    }, [chainId, pulseChain, switchChain, isConnected]);

    // Set default tokens on component mount
    useEffect(() => {
        if (swapTokenList.length > 0) {
            setFromToken(swapTokenList[0]); // PLS
            setToToken(swapTokenList[4]); // PLSX
        }
    }, []);

    useEffect(() => {
        const fetchBalance = async () => {
            if (address) {
                if (fromToken == null) return;
                if (fromToken.symbol == 'PLS') {
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
                if (toToken.symbol == 'PLS') {
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
        if (fromToken?.address == '0x0000000000000000000000000000000000000000' && toToken?.address == '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'){
            setSwapType(0); // Wrap
            return;
        }
        if (fromToken?.address == '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' && toToken?.address == '0x0000000000000000000000000000000000000000'){
            setSwapType(1); // Unwrap
            return;
        }
        if (fromToken?.address == '0x0000000000000000000000000000000000000000' && lastChanged == 'from'){
            setSwapType(2); // swapExactETHForTokens
            return;
        }
        if (fromToken?.address == '0x0000000000000000000000000000000000000000' && lastChanged == 'to'){
            setSwapType(3); // swapETHForExactTokens
            return;
        }
        if (toToken?.address == '0x0000000000000000000000000000000000000000' && lastChanged == 'from'){
            setSwapType(4); // swapExactTokensForETH
            return;
        }
        if (toToken?.address == '0x0000000000000000000000000000000000000000' && lastChanged == 'to'){
            setSwapType(5); // swapTokensForExactETH
            return;
        }
        if (lastChanged == 'from'){
            setSwapType(6); // swapExactTokensForTokens
            return;
        }
        if (lastChanged == 'to'){
            setSwapType(7); // swapTokensForExactTokens
        }
    }, [fromToken, toToken, lastChanged, isLoading]);

    const filteredTokens = swapTokenList.filter(token => {
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
                        onClick={() => setShowTokenSelector(null)}
                        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
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
                                    }}
                                    className="flex items-center p-3 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-600"
                                >
                                    <img
                                        src={token.logoURI}
                                        alt={token.symbol}
                                        className="w-8 h-8 rounded-full mr-3 flex-shrink-0"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://via.placeholder.com/32/6366f1/ffffff?text=?';
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-medium truncate">{token.symbol}</div>
                                        <div className="text-gray-400 text-sm truncate">{token.name}</div>
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
        setLastChanged('from');
    };

    const handleToAmountChange = (value: string) => {
        if (isNaN(Number(value)) || value == ''){
            setFromAmount('');
        }
        setToAmount(value);
        setLastChanged('to');
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
            await swapETHForExactTokens();
        }
        else if (swapType == 4){
            await approveTokens();
            await swapExactTokensForETH();
        }
        else if (swapType == 5){
            await approveTokens();
            await swapTokensForExactETH();
        }
        else if (swapType == 6){
            await approveTokens();
            await swapExactTokensForTokens();
        }
        else if (swapType == 7){
            await approveTokens();
            await swapTokensForExactTokens();
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
            showPending('Swapping PLS');

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 - slippagePercent) * 1000));
            const amount = parseUnits(toAmount, toToken?.decimals ?? 0);
            const amountOutMin = (amount * slippageFactor) / BigInt(1000);

            const hash = await writeContractAsync({
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapExactETHForTokens',
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

    const swapETHForExactTokens = async () => {
        setIsLoading(true);
        try {
            showPending('Swapping PLS');

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const hash = await writeContractAsync({
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapETHForExactTokens',
                chainId: 369,
                value: parseUnits(fromAmount, 18),
                args: [parseUnits(toAmount, toToken?.decimals ?? 0), path, address, deadline]
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
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapExactTokensForETH',
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

    const swapTokensForExactETH = async () => {
        setIsLoading(true);
        try {
            showPending(`Swapping ${fromToken?.symbol} into PLS`);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 + slippagePercent) * 1000));
            const amount = parseUnits(fromAmount, fromToken?.decimals ?? 0);
            const amountInMax = (amount * slippageFactor) / BigInt(1000);

            const hash = await writeContractAsync({
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapTokensForExactETH',
                chainId: 369,
                args: [parseUnits(toAmount, toToken?.decimals ?? 0), amountInMax, path, address, deadline]
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
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapExactTokensForTokens',
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

    const swapTokensForExactTokens = async () => {
        setIsLoading(true);
        try {
            showPending(`Swapping ${fromToken?.symbol} into ${toToken?.symbol}`);

            const deadline = Math.floor(Date.now() / 1000) + 3600;
            const slippagePercent = slippage / 100;
            const slippageFactor = BigInt(Math.floor((1 + slippagePercent) * 1000));
            const amount = parseUnits(fromAmount, fromToken?.decimals ?? 0);
            const amountInMax = (amount * slippageFactor) / BigInt(1000);

            const hash = await writeContractAsync({
                address: PulseX_Router_Address,
                abi: PulseX_Router_ABI,
                functionName: 'swapTokensForExactTokens',
                chainId: 369,
                args: [parseUnits(toAmount, toToken?.decimals ?? 0), amountInMax, path, address, deadline]
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

        // 1. Read current allowance
        const allowance = await readContract(config, {
            address: fromToken.address as `0x${string}`,
            abi: Erc20_ABI,
            functionName: 'allowance',
            args: [
                address,                // owner (user's address)
                PulseX_Router_Address   // spender (router)
            ],
            chainId: 369
        });

        const amountToApprove = parseUnits(fromAmount, fromToken.decimals);

        // 2. If allowance is enough, skip approve
        if (BigInt(allowance as string) >= amountToApprove) {
            return;
        }

        try {
            showPending('Approve token spending');

            // 3. Approve
            const txHash = await writeContractAsync({
                address: fromToken.address as `0x${string}`,
                abi: Erc20_ABI,
                functionName: 'approve',
                args: [
                    PulseX_Router_Address,
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

    const debounceTimeout = 400; // ms

    useEffect(() => {
        if (isProgrammaticUpdate.current) {
            isProgrammaticUpdate.current = false;
            return;
        }

        // Don't call API for wrap/unwrap
        if (swapType === 0 || swapType === 1) {
            if (lastChanged === 'from') setToAmount(fromAmount ? fromAmount : '');
            if (lastChanged === 'to') setFromAmount(toAmount ? toAmount : '');
            return;
        }

        // Debounce logic
        const handler = setTimeout(() => {
            let fromTokenAddress = fromToken?.address === '0x0000000000000000000000000000000000000000' ? WPLS_ADDRESS : fromToken?.address;
            let toTokenAddress = toToken?.address === '0x0000000000000000000000000000000000000000' ? WPLS_ADDRESS : toToken?.address;

            if (lastChanged === 'from' && fromAmount && !isNaN(Number(fromAmount)) && fromToken?.decimals) {
                setIsLoading(true);
                axios.post('http://localhost:3001/api/trading/find-path', {
                    fromToken: fromTokenAddress,
                    toToken: toTokenAddress,
                    amount: parseUnits(fromAmount, fromToken?.decimals).toString(),
                    isAmountIn: true
                }).then(res => {
                    setPath(res.data.path);
                    isProgrammaticUpdate.current = true;
                    setToAmount(formatUnits(res.data.amount, toToken?.decimals ?? 0));
                }).catch(err => {
                    console.log(err);
                }).finally(() => {
                    setIsLoading(false);
                });
            } else if (lastChanged === 'to' && toAmount && !isNaN(Number(toAmount)) && toToken?.decimals) {
                setIsLoading(true);
                axios.post('http://localhost:3001/api/trading/find-path', {
                    fromToken: fromTokenAddress,
                    toToken: toTokenAddress,
                    amount: parseUnits(toAmount, toToken?.decimals).toString(),
                    isAmountIn: false
                }).then(res => {
                    setPath(res.data.path);
                    isProgrammaticUpdate.current = true;
                    setFromAmount(formatUnits(res.data.amount, fromToken?.decimals ?? 0));
                }).catch(err => {
                    console.log(err);
                }).finally(() => {
                    setIsLoading(false);
                });
            }
        }, debounceTimeout);

        return () => clearTimeout(handler);
    }, [
        lastChanged,
        fromAmount,
        toAmount,
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
                                    onChange={e => {
                                        handleToAmountChange(e.target.value);
                                    }}
                                    disabled = {isLoading}
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
                                {[0.1, 0.5, 1.0].map((value) => (
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
