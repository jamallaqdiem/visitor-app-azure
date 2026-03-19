import React from "react";
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const VisitorDetailsForm = ({
  selectedVisitor,
  editFormData,
  setEditFormData,
  handleLogin,
  handleUpdate,
  isAgreementCheckedAdult,
  setIsAgreementCheckedAdult,
  isAgreementCheckedChild,
  setIsAgreementCheckedChild,
  handleBan,
  handleUnbanClick,
  message,
  messageType,
  handleCancelLogIn,
  handleRecordMissedVisitClick,
}) => {
  if (!selectedVisitor) return null;

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDependentEditChange = (index, e) => {
    const { name, value } = e.target;
    const newDependents = (editFormData.additional_dependents || []).map(
      (dep, i) => {
        if (i === index) {
          return {
            ...dep,
            [name]: name === "age" ? parseInt(value) || "" : value,
          };
        }
        return dep;
      },
    );
    setEditFormData((prev) => ({
      ...prev,
      additional_dependents: newDependents,
    }));
  };
  const isError = messageType === "error" && message;
  const isSuccess = messageType === "success" && message;

  const handleAddDependent = () => {
    setEditFormData((prev) => ({
      ...prev,
      additional_dependents: [
        ...(prev.additional_dependents || []),
        { full_name: "", age: "" },
      ],
    }));
  };

  const handleRemoveDependent = (index) => {
    setEditFormData((prev) => ({
      ...prev,
      additional_dependents: prev.additional_dependents.filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const dependents = editFormData.additional_dependents || [];
  const hasName = (dep) => dep.full_name && dep.full_name.trim() !== "";
  const hasValidAge = (dep) => Number(dep.age) > 0;

  const validDependents = dependents.filter(
    (dep) => hasName(dep) && hasValidAge(dep),
  );
  const isDependentDataIncomplete = dependents.some((dep) => {
    const namePresent = hasName(dep);
    const agePresent = hasValidAge(dep);

    if (namePresent && !agePresent) return true;
    if (!namePresent && agePresent) return true;
    return false;
  });
  const isBanned =
    selectedVisitor.is_banned === 1 || selectedVisitor.is_banned === true;
  const isAgreementRequired = [
    "contractor",
    "visitor",
    "professional",
  ].includes(editFormData.type);

  const isAdultNotAcknowledged =
    isAgreementRequired && !isAgreementCheckedAdult;
  const isChildAgreementRequired =
    validDependents.length > 0 && editFormData.type === "visitor";
  const isChildNotAcknowledged =
    isChildAgreementRequired && !isAgreementCheckedChild;
  const shouldDisable =
    isBanned ||
    isAdultNotAcknowledged ||
    isChildNotAcknowledged ||
    isDependentDataIncomplete;

  return (
    <div className="w-full max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-xl shadow-2xl border border-blue-100">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
        Visitor Details
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Left Column - Export & Photo */}
        <div className="md:col-span-1 flex flex-col items-start space-y-4">
          <div className="flex flex-col items-center w-full mt-6">
            <div className="w-60 h-60 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center border-4 border-gray-300 shadow-inner">
              <img
                src={
                  selectedVisitor.photo
                    ? selectedVisitor.photo
                    : "https://placehold.co/160x160/ccc/666?text=No+Photo"
                }
                alt="Visitor Photo"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if the URL itself is broken
                  e.target.onerror = null;
                  e.target.src =
                    "https://placehold.co/160x160/ccc/666?text=No+Photo";
                }}
              />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mt-3">
              {selectedVisitor.first_name} {selectedVisitor.last_name}
            </h3>
            {isBanned && (
              <span className="mt-2 text-lg font-bold text-red-600 p-1 bg-red-100 rounded-md">
                BANNED
              </span>
            )}
          </div>
        </div>

        {/* Right Column - Form Fields */}
        <div className="md:col-span-1 grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Visitor type
            </label>
            <select
              name="type"
              value={editFormData.type || "visitor"}
              onChange={handleEditChange}
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow bg-white"
            >
              <option value="visitor">Guest</option>
              <option value="contractor">Contractor</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          {["contractor", "professional"].includes(editFormData.type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Company / Organization
              </label>
              <input
                type="text"
                name="company_name"
                value={editFormData.company_name || ""}
                onChange={handleEditChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow"
              />
            </div>
          )}

          {/* known by any other names*/}
          {["visitor"].includes(editFormData.type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Known by other Names
              </label>
              <input
                type="text"
                name="known_as"
                value={editFormData.known_as || ""}
                onChange={handleEditChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow"
              />
            </div>
          )}
          {/* address  */}
          {["visitor"].includes(editFormData.type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 ">
                Address
              </label>
              <textarea
                rows="2"
                name="address"
                value={editFormData.address || ""}
                onChange={handleEditChange}
                className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow resize-none"
              />
            </div>
          )}
          {/* Phone Number & Unit  */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="text"
              name="phone_number"
              value={editFormData.phone_number || ""}
              onChange={handleEditChange}
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Flat/Unit{" "}
            </label>
            <input
              type="text"
              name="unit"
              value={editFormData.unit || ""}
              onChange={handleEditChange}
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow"
            />
          </div>

          {/* Reason for Visit & Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Note/Reason for Visit
            </label>
            <input
              type="text"
              name="reason_for_visit"
              value={editFormData.reason_for_visit || ""}
              onChange={handleEditChange}
              className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition-shadow"
            />
          </div>

          {/* Type & Dependents Label */}
          {["visitor"].includes(editFormData.type) && (
            <div className="self-end">
              <label className="block text-sm font-medium text-gray-700">
                Additional Dependents
              </label>

              <div className="md:col-span-2 space-y-3 pt-2">
                {dependents.map((dependent, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row gap-3 items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <input
                      type="text"
                      name="full_name"
                      placeholder="Dependent's Name"
                      value={dependent.full_name || ""}
                      onChange={(e) => handleDependentEditChange(index, e)}
                      className="flex-grow p-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min="1"
                      name="age"
                      placeholder="Age"
                      value={dependent.age || ""}
                      onChange={(e) => handleDependentEditChange(index, e)}
                      className="w-full sm:w-20 p-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDependent(index)}
                      className="w-full sm:w-auto px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-md"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddDependent}
                  className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors mt-2 p-1 rounded-md hover:bg-blue-50"
                >
                  + Add Dependent
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {message && (isError || isSuccess) && (
        <div
          className={`p-3 rounded-lg text-center font-medium mb-4 ${
            messageType === "error"
              ? "bg-red-100 text-red-700 border-red-300"
              : messageType === "success"
                ? "bg-green-100 text-green-700 border-green-300"
                : "bg-blue-100 text-blue-700 border-blue-300"
          } border`}
        >
          {message}
        </div>
      )}
      {isChildAgreementRequired && (
        <div className="mt-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAgreementCheckedChild}
              onChange={(e) => setIsAgreementCheckedChild(e.target.checked)}
              className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            />
            <span className="text-base font-medium  text-red-500">
              * Child Agreement & Disclaimer Paper form signed and kept (Staff
              Check)
            </span>
          </label>
        </div>
      )}

      {["contractor"].includes(editFormData.type) && (
        <div className="mt-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAgreementCheckedAdult}
              onChange={(e) => setIsAgreementCheckedAdult(e.target.checked)}
              className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            />
            <span className="text-base font-medium  text-red-500">
              * Contractor H&S and Site Risk Assessment briefing completed and
              confirmed (Staff Check)
            </span>
          </label>
        </div>
      )}
      {["visitor", "professional"].includes(editFormData.type) && (
        <div className="mt-6">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAgreementCheckedAdult}
              onChange={(e) => setIsAgreementCheckedAdult(e.target.checked)}
              className="form-checkbox h-5 w-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
            />
            <span className="text-base font-medium  text-red-500">
              * Visitor Agreement & Disclaimer Paper form signed and kept (Staff
              Check)
            </span>
          </label>
        </div>
      )}
      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 pt-8 border-t mt-8">
        <button
          onClick={handleRecordMissedVisitClick}
          className={`px-8 py-3 font-bold rounded-lg transition-all shadow-xl ${
            shouldDisable
              ? "bg-gray-400 text-gray-700 cursor-not-allowed"
              : "bg-yellow-700 -600 text-white hover:bg-yellow-900 -700"
          }`}
          disabled={shouldDisable}
        >
          Correct Missed Entry
        </button>
        <button
          onClick={() => handleLogin(selectedVisitor.id)}
          className={`px-8 py-3 font-bold rounded-lg transition-all shadow-xl ${
            shouldDisable
              ? "bg-gray-400 text-gray-700 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          disabled={shouldDisable}
        >
          Sign In
        </button>

        <button
          onClick={
            isBanned
              ? () => handleUnbanClick(selectedVisitor.id)
              : () => handleBan(selectedVisitor.id)
          }
          className={`px-8 py-3 font-bold rounded-lg transition-all shadow-xl ${
            isBanned
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          }`}
        >
          {isBanned ? "Unban" : "Ban"}
        </button>

        <button
          onClick={handleUpdate}
          className={`px-8 py-3 font-bold rounded-lg transition-all shadow-xl whitespace-nowrap ${
            shouldDisable
              ? "bg-gray-400 text-gray-700 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
          disabled={shouldDisable}
        >
          Save Updates & Sign In
        </button>

        <button
          onClick={handleCancelLogIn}
          className="px-8 py-3 font-bold rounded-lg bg-red-800 text-white hover:bg-red-900 transition-colors shadow-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default VisitorDetailsForm;
