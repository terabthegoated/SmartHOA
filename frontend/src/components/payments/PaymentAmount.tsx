export interface PaymentBalance {
  amount_due: string | number;
  balance_due?: number;
  principal_amount?: number;
  interest_amount?: number;
  balance_as_of?: string;
  awaiting_verification?: boolean;
  same_month_dues_count?: number;
  payment_status: string;
}

export const paymentTotal = (payment: PaymentBalance) => Number(payment.balance_due ?? payment.amount_due);
export const formatPesos = (value: number) => `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentAmount({ payment }: { payment: PaymentBalance }) {
  const paid = payment.payment_status === 'Paid';
  return <div>
    <span className="font-bold">{formatPesos(paymentTotal(payment))}</span>
    {!paid && Number(payment.interest_amount) > 0 && (
      <p className="mt-1 text-xs font-normal text-gray-500">
        Base {formatPesos(Number(payment.principal_amount ?? payment.amount_due))} + interest {formatPesos(Number(payment.interest_amount))}
      </p>
    )}
    {payment.awaiting_verification && <p className="mt-1 text-xs font-normal text-blue-600">Amount held at receipt submission</p>}
    {!paid && Number(payment.same_month_dues_count) > 1 && <p className="mt-1 text-xs font-normal text-amber-700">Multiple dues bills this month - ask the HOA to review.</p>}
  </div>;
}
