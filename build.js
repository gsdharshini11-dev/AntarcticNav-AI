import { build } from 'vite';

build().then(() => {
  console.log('AntarcticNav AI build complete!');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
