const zustandMiddleware = require('zustand/middleware') as typeof import('zustand/middleware');

export const { createJSONStorage, persist } = zustandMiddleware;
