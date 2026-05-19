import { createContext, useContext, type ReactNode } from 'react';

export const RootHandleContext = createContext<FileSystemDirectoryHandle | null>(null);

export function useRootHandle(): FileSystemDirectoryHandle | null {
  return useContext(RootHandleContext);
}

export function RootHandleProvider({
  value,
  children,
}: {
  value: FileSystemDirectoryHandle | null;
  children: ReactNode;
}) {
  return <RootHandleContext.Provider value={value}>{children}</RootHandleContext.Provider>;
}
