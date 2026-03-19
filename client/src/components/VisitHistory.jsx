import React from "react";
import { Search, ChevronDown, RefreshCcw, Loader, WifiOff } from "lucide-react";

/**
 * Formats an ISO string timestamp into separate date and time strings.
 * This allows the output to be stacked vertically (two lines) in the table cells,
 * ensuring all details (including year and seconds) are visible without overflow.
 * @param {string} isoString - The ISO 8601 time string.
 * @returns {{date: string, time: string}} An object with formatted date and time parts.
 */
const formatDate = (isoString) => {
  if (!isoString) return { date: "N/A", time: "N/A" };
  const dateObj = new Date(isoString); // Date format includes day, month, and year (for the top line)

  const datePart = dateObj.toLocaleString("en-UK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }); // Time format includes hour, minute, and second (for the bottom line)

  const timePart = dateObj.toLocaleString("en-UK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return { date: datePart, time: timePart };
};

// --- Table Headers Configuration ---
const columns = [
  { key: "first_name", label: "Name", sortable: false },
  { key: "known_as", label: "Known as", sortable: false },
  { key: "entry_time", label: "Check In", sortable: false },
  { key: "exit_time", label: "Check Out", sortable: false },
  { key: "address", label: "Address", sortable: false },
  { key: "phone_number", label: "Contact/Unit", sortable: false },
  { key: "reason_for_visit", label: "Type/Reason", sortable: false },
  { key: "dependents", label: "Dependents", sortable: false },
  { key: "is_banned", label: "Status", sortable: false },
  {
    key: "mandatory_acknowledgment_taken",
    label: "H&S Confirmed",
    sortable: false,
  },
];

/**
 * Stateless History Dashboard Component
 * All data, filter values, and action handlers are passed via props.
 * The data passed as 'data' prop is assumed to be the final, sorted data.
 */
function HistoryDashboard({
  data,
  loading,
  searchQuery,
  startDate,
  endDate,
  sortConfig,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onApplyFilters,
  onClearFilters,
  onRequestSort,
  statusMessage, // For connection status / fallback
  isOnline,
}) {
  // Helper to determine the correct sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key)
      return <ChevronDown size={14} className="opacity-30" />;
    return sortConfig.direction === "ascending" ? (
      <ArrowUp size={14} />
    ) : (
      <ArrowDown size={14} />
    );
  };

  const handleExport = () => {
    window.print();
  };

  const displayData = data;
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="p-4 font-['Inter'] print-report-container max-w-max">
      <div className="mb-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Visitors History Report
        </h1>
        <p className="text-sm text-gray-600">Generated on: {reportDate}</p>
      </div>
      {/* --- Connection Status and Fallback Message --- */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg shadow-md flex items-center print:hidden ${
            isOnline
              ? "bg-green-100 text-green-800 border-green-300"
              : "bg-red-100 text-red-800 border-red-300"
          } border`}
        >
          {!isOnline && <WifiOff size={20} className="mr-3" />}
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}
      {/* --- Filter Bar --- */}
      <div className="w-full flex flex-col md:flex-row gap-4 mb-6 p-4 bg-indigo-50 rounded-xl shadow-inner print:hidden">
        {/* Search Input */}
        <div className="relative flex-grow">
          <Search
            className="absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={12}
          />
          <input
            type="text"
            placeholder="Search by name First or Last"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)} // Calls setter in parent
            className="w-full pl-5 pr-4 py-2 border border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
          />
        </div>
        {/* Date Filters */}
        <div className="flex gap-4 w-full md:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)} // Calls setter in parent
            className="w-full pl-3 pr-2 py-2 border border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            aria-label="Start Date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)} // Calls setter in parent
            className="w-full pl-3 pr-2 py-2 border border-indigo-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
            aria-label="End Date"
          />
        </div>
        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onApplyFilters} // Calls the fetching logic in the parent
            disabled={loading}
            className={`flex items-center justify-center px-4 py-2 font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 ${
              loading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <Loader size={18} className="animate-spin mr-2" />
            ) : (
              <Search size={18} className="mr-2" />
            )}
            Apply Filters
          </button>
          <button
            onClick={onClearFilters} // Calls the reset logic in the parent
            className="flex items-center justify-center px-4 py-2 font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg shadow-md hover:bg-indigo-50 transition duration-150"
          >
            <RefreshCcw size={18} className="mr-2" />
            Reset
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center px-4 py-2 font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 transition duration-150"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>
      {/*         --- Data Table ---         */}
      <div className="shadow-2xl rounded-xl w-full px-0">
        <table className=" table-auto divide-y divide-gray-200">
          <thead className="bg-indigo-700 text-white sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && onRequestSort(col.key)} // Calls parent handler
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer ${
                    col.sortable ? "hover:bg-indigo-600 transition" : ""
                  }`}
                >
                  <div className="flex items-center whitespace-nowrap">
                    {col.label}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-lg text-indigo-500"
                >
                  <Loader
                    size={24}
                    className="animate-spin inline-block mr-2"
                  />{" "}
                  Loading records...
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-lg text-gray-500"
                >
                  {isOnline
                    ? "No historical visits found matching the criteria."
                    : "No cached data available to display."}
                </td>
              </tr>
            ) : (
              displayData.map((visit) => (
                <tr
                  key={visit.visit_id || visit.entry_time}
                  className="hover:bg-indigo-50 transition duration-100 avoid-break"
                >
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 break-words max-w-min align-middle">
                    {visit.first_name} {visit.last_name}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 max-w-[50px] align-middle">
                    {visit.known_as || "--"}
                  </td>
                  {/* Entry Time  */}
                  <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap align-middle">
                    <div className="font-medium text-gray-800 leading-tight w-fit">
                      {formatDate(visit.entry_time).date} 
                    </div>
                    <div className="text-xs text-green-500 leading-tight w-fit">
                      {formatDate(visit.entry_time).time} 
                    </div>
                  </td>
                  {/* Exit Time */}
                  <td className="px-4 py-4 text-sm whitespace-nowrap align-middle">
                    {visit.exit_time ? (
                      <div className="font-medium text-gray-800 leading-tight w-fit">
                        {" "}
                        {formatDate(visit.exit_time).date}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 break-words max-w-[10rem]">
                        Still Checked In
                      </span>
                    )}
                    {visit.exit_time && (
                      <div className="text-xs text-red-500 leading-tight w-fit">
                        {" "}
                        {formatDate(visit.exit_time).time}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 max-w-[50px] align-middle">
                    {visit.address || "--"}
                  </td>
                  {/* Phone / Unit */}
                  <td className="px-4 py-4 text-sm text-gray-500 break-words max-w-[50px] align-middle">
                    <div className="font-semibold text-gray-700">
                      {visit.phone_number || "--"}
                    </div>
                    <div className="text-xs text-gray-400">
                      Unit/flat: {visit.unit || "--"}
                    </div>
                  </td>
                  {/* Reason / Type */}
                  <td className="px-3 py-3 text-sm text-gray-500 break-words max-w-[50px] align-middle">
                    <div className="text-xs text-indigo-400 uppercase">
                      {visit.type || "--"}
                    </div>
                    <div className="font-semibold whitespace-normal max-w-full leading-snug">
                      {visit.reason_for_visit || "--"}
                    </div>
                    {visit.company_name && (
                      <div className="text-xs text-gray-400 whitespace-normal leading-tight">
                        Company: {visit.company_name}
                      </div>
                    )}
                  </td>
                  {/* Dependents */}
                  <td className="px-4 py-4 text-sm text-gray-500 max-w-[100px] align-middle">
                    {visit.dependents && visit.dependents.length > 0 ? (
                      <ul className="pl-5 text-xs text-gray-600 list-none p-0 m-0">
                        {" "}
                        {visit.dependents.map((dep, index) => (
                          <li
                            key={index}
                            className="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-indigo-400"
                          >
                            {dep.full_name} (Age: {dep.age}){" "}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-600 pl-5 before:content-['•'] text-xs">
                        None
                      </span>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-4 text-sm max-w-[10px] align-middle">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        visit.is_banned ? " text-red-600" : " text-blue-800"
                      }`}
                    >
                      {visit.is_banned ? "BANNED" : "Clear"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm max-w-sm align-middle">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        visit.mandatory_acknowledgment_taken
                          ? " text-blue-800"
                          : " text-red-600"
                      }`}
                    >
                      {visit.mandatory_acknowledgment_taken
                        ? "COMPLETED"
                        : "PENDING"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className="mt-6 text-center text-sm text-gray-400">
        Displaying {displayData.length} total records.
      </footer>
    </div>
  );
}

export default HistoryDashboard;
