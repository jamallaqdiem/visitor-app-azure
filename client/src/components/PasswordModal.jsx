import React from "react";
import { EyeIcon, EyeOff } from "lucide-react";

const PasswordModal = ({
  showPasswordModal,
  EnterPassword,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  message,
  messageType,
  setShowPasswordModal,
  modalTitle,
  modalDescription,
  submitButtonText,
}) => {
  if (!showPasswordModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-blue-600">
        <h3 className="text-xl font-bold text-blue-800 mb-4">{modalTitle}</h3>
        <p className="text-gray-600 mb-4">{modalDescription}</p>

        {/* Notification Area */}
        {message && messageType === "error" && (
          <div className="p-3 rounded-lg text-center font-medium mb-4 bg-red-100 text-red-700 border border-red-300">
            {message}
          </div>
        )}

        <form onSubmit={EnterPassword} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg pr-10 focus:border-blue-500 focus:ring-blue-500 transition-shadow"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="px-4 py-2 font-semibold rounded-lg bg-red-600 text-white hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
