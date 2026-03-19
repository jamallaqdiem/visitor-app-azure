import { useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const steps = [
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
];

const TutorialModal = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-indigo-700 p-4 flex justify-between items-center text-white">
          <button
            onClick={onClose}
            className="hover:bg-indigo-600 p-1 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-8">
          <div className="flex justify-between text-xs font-bold text-black mb-4 uppercase tracking-wider">
            <span>
              Step {currentStep + 1} of {steps.length}
            </span>
            <span>
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Completed
            </span>
          </div>

          {/* Dynamic Step Card */}
          <div
            className={`p-6 rounded-xl border-l-4 shadow-sm transition-all duration-300 ${steps[currentStep].color}`}
          >
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-700 leading-relaxed text-sm">
              {steps[currentStep].description}
            </p>
          </div>

          {/* Progress Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "bg-indigo-600 w-6" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer / Controls */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center px-4 py-2 rounded-lg font-medium text-sm transition ${
              currentStep === 0
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ChevronLeft size={16} className="mr-1" /> Previous
          </button>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={onClose}
              className="flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-lg transition transform hover:scale-105"
            >
              Finish Training
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition"
            >
              Next Step <ChevronRight size={16} className="ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
