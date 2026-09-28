import { Text, type TextProps } from 'react-native';

const pesos = {
  regular: 'font-poppins',
  medium: 'font-poppins-medium',
  semibold: 'font-poppins-semibold',
  bold: 'font-poppins-bold',
};

type Props = TextProps & {
  className?: string;
  /**
   * A Poppins vem em um arquivo por peso, então no celular o peso é a família
   * da fonte, e não font-weight. Por isso vem numa prop, e não na className.
   */
  peso?: keyof typeof pesos;
};

export function Texto({ peso = 'regular', className = '', ...props }: Props) {
  return <Text className={`${pesos[peso]} ${className}`} {...props} />;
}
