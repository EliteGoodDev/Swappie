import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  pulsechain,
  mainnet
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'PulseSwap',
  projectId: 'c17e7bfc7926d61519e3582bf9521344',
  chains: [
    pulsechain,
    mainnet
  ],
  ssr: true,
});
