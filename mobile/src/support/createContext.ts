import React from 'react';

export function createContext<T>(name = 'Context') {
  const Context = React.createContext<T | undefined>(undefined);
  // eslint-disable-next-line functions/top-level-fn-decl
  function useContext() {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`use${name} must be used inside a ${name}Provider`);
    }
    return context;
  }
  return [useContext, Context.Provider] as const;
}
