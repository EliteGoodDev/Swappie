import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import Image from 'next/image';

export const Header = () => {
  return (
    <header className="w-full glass border-b border-gray-700/30 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="Swappie Logo"
              width={200}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          
          <div className="flex items-center space-x-6">
            <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-300 hover:text-white transition-all duration-300 hover:scale-105 relative group">
                <span className="relative z-10">Dashboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link> 
              <Link href="/bridge" className="text-gray-300 hover:text-white transition-all duration-300 hover:scale-105 relative group">
                <span className="relative z-10">Bridge</span>
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              <Link href="/swap" className="text-gray-300 hover:text-white transition-all duration-300 hover:scale-105 relative group">
                <span className="relative z-10">Swap</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>  
            </nav>
            <div className="flex items-center space-x-3">
              <div className="hidden md:flex items-center space-x-2 px-3 py-2 glass rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-300">Live</span>
              </div>
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}; 