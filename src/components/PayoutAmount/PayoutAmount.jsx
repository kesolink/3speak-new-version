import { IoChevronUpCircleOutline } from 'react-icons/io5';
import './PayoutAmount.scss';

function PayoutAmount({ amount, size, onClick }) {
  const display = typeof amount === 'number' ? amount.toFixed(2) : (amount ?? '…');
  const iconSize = size ? Math.round(size * 1.25) : undefined;

  return (
    <div className={`payout-amount-badge${onClick ? ' clickable' : ''}`} style={size ? { fontSize: size } : undefined} onClick={onClick}>
      <IoChevronUpCircleOutline size={iconSize || undefined} />
      <span>${display}</span>
    </div>
  );
}

export default PayoutAmount;
