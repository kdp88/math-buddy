const originalError = console.error.bind(console.error);

console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('not wrapped in act(')) {
    throw new Error(args[0]);
  }
  originalError(...args);
};
