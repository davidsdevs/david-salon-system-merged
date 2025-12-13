import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import { Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClientTransactions() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('clientId', '==', currentUser.uid),
        where('status', '==', 'paid'),
        orderBy('createdAt', 'desc')
      );
      // Note: Refunded transactions are excluded (status must be 'paid')

      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return transactions;
    return transactions.filter(t => {
      const idMatch = t.id?.toLowerCase()?.includes(searchTerm.toLowerCase());
      const branchMatch = (t.branchName || '')?.toLowerCase()?.includes(searchTerm.toLowerCase());
      const itemsMatch = (t.items || []).some(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
      return idMatch || branchMatch || itemsMatch;
    });
  }, [transactions, searchTerm]);

  if (loading) return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p className="text-gray-600">Paid transactions for your account. Click an item to view full details.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchInput value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by transaction id, branch or item..." />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No paid transactions found</h3>
          <p className="text-gray-600">You don't have any paid transactions yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tx => (
            <Card key={tx.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { setSelectedTransaction(tx); setShowDetails(true); }}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Transaction</div>
                  <div className="font-semibold text-gray-900 line-clamp-1">#{tx.id}</div>
                  <div className="text-xs text-gray-500 mt-1">{tx.branchName || 'Branch'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="font-bold text-lg text-primary-600">{formatCurrency(tx.total || tx.amount || 0)}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
                <div>{formatDate(tx.createdAt || tx.createdAt?.toDate?.())}</div>
                <div className="inline-flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-xs">
                  <Eye className="w-3 h-3" />
                  View
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Details modal */}
      {showDetails && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transaction Details</h2>
              <button onClick={() => { setShowDetails(false); setSelectedTransaction(null); }} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-gray-500">Transaction ID</div>
                  <div className="font-semibold text-gray-900">{selectedTransaction.id}</div>
                  <div className="text-xs text-gray-500 mt-1">{selectedTransaction.branchName || selectedTransaction.branchId}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Paid At</div>
                  <div className="font-semibold">{formatDate(selectedTransaction.createdAt || selectedTransaction.createdAt?.toDate?.())}</div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Items</h3>
                <div className="space-y-2">
                  {(selectedTransaction.items || []).map((item, i) => (
                    <div key={i} className="flex items-start justify-between border rounded-md p-3">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{item.name || item.title || item.productName || 'Item'}</div>
                        <div className="text-xs text-gray-500">{item.type || 'product'} • Qty: {item.quantity || 1}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">{formatCurrency(item.price || item.amount || 0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t flex justify-between items-center">
                <div className="text-sm text-gray-500">Payment Method</div>
                <div className="font-semibold">{selectedTransaction.paymentMethod || selectedTransaction.payMethod || 'N/A'}</div>
              </div>

              <div className="pt-3 border-t flex justify-between items-center">
                <div className="text-sm text-gray-500">Total</div>
                <div className="font-bold text-xl text-primary-600">{formatCurrency(selectedTransaction.total || selectedTransaction.amount || 0)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
