import React, { useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

export interface TutorialStep {
  title: string;
  description: string;
  color: string;
}

export interface TutorialModalProps {
  onClose: () => void;
}

const styles = {
  overlay:
    "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]",
  modalCard:
    "bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200",

  // Header
  header: "bg-indigo-700 p-4 flex justify-between items-center text-white",
  headerTitle: "font-semibold text-sm",
  closeButton: "hover:bg-indigo-600 p-1 rounded-full transition",

  // Content Body
  contentContainer: "p-8",
  progressHeader:
    "flex justify-between text-xs font-bold text-black mb-4 uppercase tracking-wider",
  stepCard: "p-6 rounded-xl border-l-4 shadow-sm transition-all duration-300",
  stepTitle: "text-xl font-bold text-gray-800 mb-3",
  stepDescription: "text-gray-700 leading-relaxed text-sm",

  // Progress Dots
  dotsContainer: "flex justify-center gap-2 mt-8",
  dotBase: "h-2 rounded-full transition-all duration-300",
  dotActive: "bg-indigo-600 w-6",
  dotInactive: "bg-gray-200 w-2",

  // Footer
  footer: "p-4 border-t bg-gray-50 flex justify-between items-center",
  prevButton:
    "flex items-center px-4 py-2 rounded-lg font-medium text-sm transition",
  prevActive: "text-gray-600 hover:bg-gray-200",
  prevDisabled: "text-gray-300 cursor-not-allowed",

  nextButton:
    "flex items-center px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition",
  finishButton:
    "flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-lg transition transform hover:scale-105",
};

const steps: TutorialStep[] = [
  {
    title: "Step 1: Always Search First",
    description:
      "Before registering anyone, type their name in the Search Bar. If they have visited before, their name will appear. Click 'Select' to skip typing their details again.",
    color: "bg-blue-100 border-blue-500",
  },
  {
    title: "Step 2: Registering a Visitor",
    description:
      "If they are new, click the purple 'Register New Visitor' button. In the form, change the Visitor Type to 'Guest/Professional/Contractor', Their details and if they have children, Check the mandatory box, then click 'Register & Sign In' Button.",
    color: "bg-purple-100 border-purple-500",
  },
  {
    title: "Step 3: Returning Visitors",
    description:
      "When you find a match name in the Search bar, click 'Select' on the existing visitor, then it will open a page where you can update their details, if something changed (like a new phone number or a new child...), check the mandatory box, then click 'Save Updates & Sign In' Button. If everything is the same, you can simply proceed to Sign In.",
    color: "bg-yellow-100 border-yellow-500",
  },
  {
    title: "Step 4: Agreements & Sign In",
    description:
      "The 'Sign In' buttons will remain disabled (grey) until you verify the paperwork. You MUST check the red agreement boxes for:" +
      "• NEW Registrations & RETURNING visitors." +
      "• ACCOMPANYING CHILDREN (separate check required)." +
      "Ticking these confirms the visitor has signed the physical paper disclaimer and completed the H&S briefing.",
    color: "bg-green-100 border-green-500",
  },
  {
    title: "Step 5: Bans & Time Corrections",
    description:
      "In the Visitor Details view, you have special tools: use 'Ban' for safety restrictions, or 'Correct Missed Entry' to log a visit that happened earlier but wasn't recorded.",
    color: "bg-orange-100 border-orange-500",
  },
  {
    title: "Step 6: Managing Banned Visitors",
    description:
      "If a visitor is restricted (Banned), the 'Ban' button will change to a red 'Unban' button. To lift a restriction, click 'Unban'. This requires the management password to ensure only authorized staff can restore access.",
    color: "bg-red-100 border-red-500",
  },
  {
    title: "Step 7: Accessing Historical Data",
    description:
      "To view past records, click the 'View Historical Data' button at the top right. NOTE: This area is password protected. You will need the management password to access the visitors database for reports or audits.",
    color: "bg-slate-100 border-slate-500",
  },
  {
    title: "Step 8: Permanent Data Deletion",
    description:
      "If a visitor profile must be removed for GDPR or legal reasons, use the 'Delete Profile' button. WARNING: This action is permanent. It will instantly erase the visitor's identity, their entire visit history, all saved photos, and any linked dependent records from the database.",
    color: "bg-red-300 border-black font-bold text-black",
  },
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const handleNext = (): void => {
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = (): void => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>Application Guide</span>
          <button
            onClick={onClose}
            aria-label="Close training modal"
            className={styles.closeButton}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.contentContainer}>
          <div className={styles.progressHeader}>
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <span>
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Completed
            </span>
          </div>

          {/* Dynamic Step Card */}
          <div className={`${styles.stepCard} ${steps[currentStep].color}`}>
            <h2 className={styles.stepTitle}>{steps[currentStep].title}</h2>
            <p className={styles.stepDescription}>
              {steps[currentStep].description}
            </p>
          </div>

          {/* Progress Dots */}
          <div className={styles.dotsContainer}>
            {/* using (_) as unused as step object as we need only the index num to compar */}
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`${styles.dotBase} ${
                  idx === currentStep ? styles.dotActive : styles.dotInactive
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer / Controls */}
        <div className={styles.footer}>
          <button
            onClick={handlePrev}
            disabled={isFirstStep}
            className={`${styles.prevButton} ${
              isFirstStep ? styles.prevDisabled : styles.prevActive
            }`}
          >
            <ChevronLeft size={16} className="mr-1" /> Previous
          </button>

          {isLastStep ? (
            <button onClick={onClose} className={styles.finishButton}>
              Finish Training
            </button>
          ) : (
            <button onClick={handleNext} className={styles.nextButton}>
              Next Step <ChevronRight size={16} className="ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
