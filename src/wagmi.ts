import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  pulsechain,
  mainnet
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'PulseSwap',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    pulsechain,
    mainnet
  ],
  ssr: true,
});
