export const ContractorHandoverModal = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Dark Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-red-600 animate-in fade-in zoom-in duration-200">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-red-100 p-3 rounded-full">
              <span className="text-2xl">🛠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight">
              Contractor Handover
            </h2>
          </div>

          <div className="space-y-4 text-gray-700 leading-relaxed mb-8">
            <p>
              Please remind the contractor to report their{" "}
              <strong>work status</strong> and any
              <strong> missing parts</strong> to the Handyman or Management
              before they leave.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onCancel}
              className="order-2 sm:order-1 px-5 py-2.5 text-gray-500 hover:text-gray-700 font-semibold transition-colors"
            >
              Wait, Not Yet
            </button>
            <button
              onClick={onConfirm}
              className="order-1 sm:order-2 px-8 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95"
            >
              Yes, Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorHandoverModal;
