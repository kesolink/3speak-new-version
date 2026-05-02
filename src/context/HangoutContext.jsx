import { createContext, useContext, useState } from 'react';

const HangoutContext = createContext(undefined);

export function HangoutContextProvider({ children }) {
  const [activeRoom, setActiveRoom] = useState(null);
  return (
    <HangoutContext.Provider value={{
      activeRoom,
      openRoom: setActiveRoom,
      closeRoom: () => setActiveRoom(null),
    }}>
      {children}
    </HangoutContext.Provider>
  );
}

export function useHangout() {
  const ctx = useContext(HangoutContext);
  if (!ctx) throw new Error('useHangout must be used within HangoutContextProvider');
  return ctx;
}
