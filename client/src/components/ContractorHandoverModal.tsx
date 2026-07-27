// Props Interface
interface ContractorHandoverModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
export const ContractorHandoverModal: React.FC<
  ContractorHandoverModalProps
> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  const STYLES = {
    overlay: "fixed inset-0 z-[9999] flex items-center justify-center p-4",
    backdrop: "absolute inset-0 bg-slate-900/60 backdrop-blur-sm",
    modalContainer:
      "relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-red-600 animate-in fade-in zoom-in duration-200",
    contentPadding: "p-8",
    headerGroup: "flex items-center gap-4 mb-6",
    iconBadge: "bg-red-100 p-3 rounded-full",
    title: "text-xl font-bold text-gray-900 uppercase tracking-tight",
    bodyText: "space-y-4 text-gray-700 leading-relaxed mb-8",
    buttonGroup: "flex flex-col sm:flex-row justify-end gap-3",
    cancelBtn:
      "order-2 sm:order-1 px-5 py-2.5 text-gray-500 hover:text-gray-700 font-semibold transition-colors",
    confirmBtn:
      "order-1 sm:order-2 px-8 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95",
  } as const;

  return (
    <div className={STYLES.overlay}>
      {/* Dark Overlay */}
      <div className={STYLES.backdrop} onClick={onCancel} />

      {/* Modal Card */}
      <div className={STYLES.modalContainer}>
        <div className={STYLES.contentPadding}>
          <div className={STYLES.headerGroup}>
            <div className={STYLES.iconBadge}>
              <span className="text-2xl">🛠️</span>
            </div>
            <h2 className={STYLES.title}>Contractor Handover</h2>
          </div>

          <div className={STYLES.bodyText}>
            <p>
              Please remind the contractor to report their{" "}
              <strong>work status</strong> and any{" "}
              <strong>missing parts</strong> to the Handyman or Management
              before they leave.
            </p>
          </div>

          <div className={STYLES.buttonGroup}>
            <button onClick={onCancel} className={STYLES.cancelBtn}>
              Wait, Not Yet
            </button>
            <button onClick={onConfirm} className={STYLES.confirmBtn}>
              Yes, Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorHandoverModal;
