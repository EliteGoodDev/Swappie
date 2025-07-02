import type { NextPage } from 'next';
import {  useEffect } from 'react';
import { useChainId, useSwitchChain, useChains, useAccount } from 'wagmi';

const Swap: NextPage = () => {

    const chainId = useChainId();
    const chains = useChains();
    const { switchChain } = useSwitchChain();
    const { address, isConnected } = useAccount();
    // Find Ethereum Mainnet in your supported chains
    const pulseChain = chains.find(chain => chain.id === 369);

    useEffect(() => {
        if (!isConnected) {
            alert('Please connect your wallet to continue');
            return;
        }
        // If not on Ethereum Mainnet, prompt to switch
        if (chainId !== 369 && pulseChain && switchChain) {
            switchChain({ chainId: 369 });
        }
    }, [chainId, pulseChain, switchChain, isConnected]);

    return (
        <div className="container mx-auto px-4 py-20">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold gradient-text mb-2">
                        Swap Tokens
                    </h1>
                    <p className="text-gray-300">
                        Exchange tokens instantly with the best rates
                    </p>
                </div>
                <iframe 
                    src="https://widget.piteas.io/#/swap?inputCurrency=&outputCurrency=&theme=dark" 
                    height="800px" 
                    width="100%" 
                    style={{
                        border: 0,
                        margin: '0 auto',
                        display: 'block',
                        maxWidth: '1200px',
                        minWidth: '400px'
                    }}
                />
            </div>
        </div>
    );
};

export default Swap;
