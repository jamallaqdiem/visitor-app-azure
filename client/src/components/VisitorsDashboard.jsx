import React from "react";
import { SearchIcon, PersonIcon } from "./IconComponents";

// Function to format time for display
const formatTime = (timeString) => {
  if (!timeString) return "N/A";
  return new Date(timeString).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};
//helper function
const formatDependents = (dependentsArray) => {
  // 1. Check if the backend actually sent an array
  if (!Array.isArray(dependentsArray) || dependentsArray.length === 0) {
    return "None";
  }

  // 2. Map over the objects directly
  return dependentsArray
    .map((dep) => `${dep.full_name || "--"} (${dep.age || "--"})`)
    .join(", ");
};

const VisitorsDashboard = ({
  searchTerm,
  loadingDashboard,
  searchResults,
  handleVisitorSelect,
  loadingInSite,
  errorInSite,
  visitors,
  handleExit,
  message,
  messageType,
  handleSearchInput,
}) => {
  const isError = messageType === "error" && message;
  const isSuccess = messageType === "success" && message;

  return (
    <div className=" max-w-full mx-auto space-y-8">
      {/* Search Card */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl transition-all border border-blue-100">
        <h2 className="text-3xl font-bold text-blue-700 mb-4 text-center">
          Visitors Dashboard
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-grow">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name (e.g., John Doe)..."
              value={searchTerm}
              onChange={handleSearchInput} // Live search trigger
              className="w-full pl-10 pr-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring-blue-500 transition duration-200 shadow-inner"
              disabled={loadingDashboard}
            />
          </div>
        </div>

        {/* Notification Area for Search Status */}
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

        {loadingDashboard && searchTerm.length > 0 && (
          <div className="text-center py-4 text-blue-500 font-semibold">
            Searching for "{searchTerm}"...
          </div>
        )}

        {/* Search Results (Visible after search is complete or typing has slowed) */}
        {searchResults.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-xl font-semibold text-blue-800 mb-3">
              Search Results ({searchResults.length})
            </h3>
            <div className="space-y-3">
              {searchResults.map((visitor) => (
                <div
                  key={visitor.id}
                  className={`flex justify-between items-center p-4 rounded-lg cursor-pointer transition-all ${
                    visitor.is_banned === 1
                      ? "bg-red-50 hover:bg-red-100 border border-red-300"
                      : "bg-green-50 hover:bg-green-100 border border-green-300"
                  }`}
                  onClick={() => handleVisitorSelect(visitor)}
                >
                  <div className="flex items-center space-x-3">
                    <PersonIcon className="h-6 w-6 text-blue-500" />
                    <span className="font-medium text-gray-700">
                      {visitor.first_name} {visitor.last_name}
                      {visitor.is_banned === 1 ||
                        (visitor.is_banned === true && (
                          <span className="ml-2 text-sm font-bold text-red-600">
                            (BANNED)
                          </span>
                        ))}
                    </span>
                  </div>
                  <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If no results, prompt for registration */}
      </div>

      {/* Who is On Site Table */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl transition-all border border-blue-100">
        <h2 className="text-2xl font-bold text-blue-700 mb-4 text-center">
          Who is On Site?
        </h2>

        {loadingInSite && (
          <div className="text-center py-4 text-blue-500 font-semibold">
            Loading active visitors...
          </div>
        )}

        {errorInSite && (
          <div className="text-center py-4 text-red-500 font-semibold">
            Error: {errorInSite}
          </div>
        )}

        {!loadingInSite && visitors.length === 0 && !errorInSite && (
          <div className="text-center py-4 text-gray-500 font-medium">
            No visitors are currently signed in.
          </div>
        )}

        {visitors.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-blue-200">
              <thead>
                <tr className="bg-blue-50 text-left text-xs font-semibold uppercase tracking-wider text-blue-600">
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Dependents/Age</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="px-4 py-3 hidden md:table-cell ">Unit</th>
                  <th className="px-4 py-3 hidden md:table-cell ">Reason</th>
                  <th className="px-4 py-3 whitespace-nowrap">Entry Time</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 bg-white">
                {visitors.map((v) => (
                  <tr key={v.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 ">
                      {v.first_name} {v.last_name}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-600 capitalize ">
                      {formatDependents(v.dependents)}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-gray-600 capitalize ">
                      {v.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 break-words max-w-[10rem]">
                      {v.unit || "---"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600 break-words max-w-[10rem]">
                      {v.reason_for_visit || "---"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 ">
                      {formatTime(v.entry_time)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleExit(v.id)}
                        className="text-red-600 font-semibold hover:text-red-800 transition-colors text-sm whitespace-nowrap"
                      >
                        Sign Out
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisitorsDashboard;
