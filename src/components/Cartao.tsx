import { View, type ViewProps } from 'react-native';

/** O card branco de cantos largos que o site usa em toda seção. */
export function Cartao({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-surface-container-lowest rounded-3xl p-stack-md shadow-lg shadow-black/10 ${className}`}
      {...props}
    />
  );
}
