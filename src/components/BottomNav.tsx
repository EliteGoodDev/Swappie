import { useRouter } from 'next/router';
import Link from 'next/link';

const BottomNav = () => {
  const router = useRouter();

  const isActive = (path: string) => {
    return router.pathname === path;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700 z-50 md:hidden">
      <div className="flex items-center justify-around py-2">
        <Link
          href="/"
          className={`flex flex-col items-center py-3 px-4 rounded-lg transition-colors ${
            isActive('/')
              ? 'text-blue-500 bg-blue-500/10'
              : 'text-gray-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span className="text-xs font-medium">Swap</span>
        </Link>

        <Link
          href="/bridge"
          className={`flex flex-col items-center py-3 px-4 rounded-lg transition-colors ${
            isActive('/bridge')
              ? 'text-blue-500 bg-blue-500/10'
              : 'text-gray-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <svg
            className="w-6 h-6 mb-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
          <span className="text-xs font-medium">Bridge</span>
        </Link>
      </div>
    </div>
  );
};

export default BottomNav;
