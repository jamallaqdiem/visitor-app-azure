import React, { useState, useEffect, useCallback, useRef } from "react";
import VisitorsDashboard from "./components/VisitorsDashboard";
import VisitorDetailsForm from "./components/VisitorDetailsForm";
import VisitorRegistrationForm from "./components/VisitorRegistrationForm";
import PasswordModal from "./components/PasswordModal";
import RecordMissedVisitModal from "./components/RecordMissedVisitModal";
import HistoryDashboard from "./components/VisitHistory";

const API_BASE_URL = "";

// Initial state for the registration form
const initialRegistrationForm = {
  firstName: "",
  lastName: "",
  knownAs: "",
  address: "",
  phoneNumber: "",
  unit: "",
  reasonForVisit: "",
  visitorType: "visitor",
  companyName: "",
  photo: null,
};

function App() {
  // --- Global State & Loading ---
  const [visitors, setVisitors] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingRegistration, setLoadingRegistration] = useState(false);

  // --- UI/Mode State ---
  const [searchTerm, setSearchTerm] = useState("");
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  // --- Registration Form State ---
  const [regFormData, setRegFormData] = useState(initialRegistrationForm);
  const [regDependents, setRegDependents] = useState([]);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [isAgreementCheckedAdult, setIsAgreementCheckedAdult] = useState(false);
  const [isAgreementCheckedChild, setIsAgreementCheckedChild] = useState(false);

  // --- History data State ---
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [filteredHistoryData, setFilteredHistoryData] = useState([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "entry_time",
    direction: "descending",
  });

  // --- Visitor Details/Update Form State ---
  const [editFormData, setEditFormData] = useState({});
  const [isDetailsAgreementChecked, setIsDetailsAgreementChecked] = useState(false);

  // --- Notification State (Global for forms and dashboard) ---
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // --- Global Password/Modal State ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState(""); // Universal password input state
  const [showPassword, setShowPassword] = useState(false); // Universal show/hide password state

  // --- Modal Context State (Tracks the pending action) ---
  const [modalContext, setModalContext] = useState({
    type: null, 
    visitorId: null, 
    title: "",
    description: "",
    submitText: "",
    submitColor: "bg-green-600 hover:bg-green-700",
  });

  // --- Record Missed Visit Modal State ---
  const [showMissedVisitModal, setShowMissedVisitModal] = useState(false);
  const [missedEntryTime, setMissedEntryTime] = useState("");

  // Debounce for live search
  const debounceTimeoutRef = useRef(null);

  // Helper function for showing a transient message
  const showNotification = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  // --- Utility function to sort data  ---
  const sortData = useCallback((data, config) => {
    if (!config.key) return data;

    const sortedData = [...data].sort((a, b) => {
      let aValue = a[config.key];
      let bValue = b[config.key]; // Custom sort for name field

      if (config.key === "first_name") {
        aValue = `${a.first_name} ${a.last_name}`;
        bValue = `${b.first_name} ${b.last_name}`;
      } // Handle null/undefined values

      if (aValue === null || aValue === undefined)
        return config.direction === "ascending" ? 1 : -1;
      if (bValue === null || bValue === undefined)
        return config.direction === "ascending" ? -1 : 1;

      if (aValue < bValue) {
        return config.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return config.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });

    return sortedData;
  }, []);

  // --- API: Fetch Currently Signed-In Visitors ---
  const fetchVisitors = useCallback(async () => {
    // Only show loading indicator initially or when explicitly triggered
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/visitors`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setVisitors(data);
    } catch (err) {
      console.error("Error fetching visitors:", err);
      setError("Failed to load active visitors.");
      setVisitors([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // EFFECT: Auto-refresh "Who is On Site" table every 5 seconds
  useEffect(() => {
    // Fetch immediately on mount
    fetchVisitors();

    // Set up interval for refreshing every 5000ms
    const intervalId = setInterval(fetchVisitors, 5000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchVisitors]);

  // --- API: Visitor Search (Live Search with Debounce) ---
  const handleVisitorSearch = useCallback(async (term) => {
    const trimmedTerm = term.trim();
    setSearchResults([]);
    setSelectedVisitor(null);

    if (!trimmedTerm) {
      setIsLoading(false);
      setShowRegistration(false);
      return;
    }

    setIsLoading(true);

    try {
      const encodedSearchTerm = encodeURIComponent(trimmedTerm);
      const url = `${API_BASE_URL}/api/visitor-search?name=${encodedSearchTerm}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to perform visitor search.");
      }

      setSearchResults(data);
      if (data.length === 0) {
        showNotification("No visitor found. Please register.", "error");
        setShowRegistration(true); // Auto-redirect to registration
      } else {
        showNotification("Visitor(s) found. Select one to log in.", "success");
        setShowRegistration(false);
      }
    } catch (err) {
      console.error("Search Error:", err.message);
      showNotification(`Search Failed: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchInput = useCallback((e) => {
    const term = e.target.value;
    setSearchTerm(term);

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set a new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      handleVisitorSearch(term);
    }, 600);
  });

  // --- Visitor Selection Handler ---
  const handleVisitorSelect = (visitor) => {
    setSelectedVisitor(visitor);
    // Prepare edit form data
    setEditFormData({
      id: visitor.id,
      known_as: visitor.known_as || "",
      address: visitor.address || "",
      phone_number: visitor.phone_number || "",
      unit: visitor.unit || "",
      reason_for_visit: visitor.reason_for_visit || "",
      type: visitor.type || "visitor",
      company_name: visitor.company_name || "",
      mandatory_acknowledgment_taken: visitor.mandatory_acknowledgment_taken || "",
      additional_dependents:
        visitor.dependents && Array.isArray(visitor.dependents)
          ? visitor.dependents
          : (typeof visitor.additional_dependents === "string"
              ? JSON.parse(visitor.additional_dependents)
              : visitor.additional_dependents) || [],
    });
    setSearchResults([]);
    setSearchTerm("");
    setShowRegistration(false); 
    setIsAgreementCheckedAdult(false); 
    setIsAgreementCheckedChild(false);
    showNotification("Visitor details loaded.", "blue");
  };

  // Cancel/Back to Dashboard Handler
  const handleCancelAction = () => {
    setRegFormData(initialRegistrationForm);
    setRegDependents([]);
    setPhotoPreviewUrl(null);
    setIsAgreementCheckedAdult(false); 
    setIsAgreementCheckedChild(false);
    setSelectedVisitor(null);
    setSearchResults([]);
    setSearchTerm("");
    setShowRegistration(false);
    showNotification("Action cancelled. Back to dashboard.", "blue");
  };

  // Handle Registration Handlers
  const handleRegInputChange = (e) => {
    const { name, value } = e.target;
    setRegFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRegFormData((prev) => ({ ...prev, photo: file }));
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAddDependent = () => {
    setRegDependents((prev) => [...prev, { full_name: "", age: "" }]);
  };

  const handleRemoveDependent = (index) => {
    setRegDependents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDependentChange = (index, e) => {
    const { name, value } = e.target;
    const newDependents = regDependents.map((dep, i) => {
      if (i === index) {
        return {
          ...dep,
          [name]: name === "age" ? parseInt(value) || "" : value,
        };
      }
      return dep;
    });
    setRegDependents(newDependents);
  };

  const handleNewVisitorRegistration = async (e) => {
    e.preventDefault();
    if (loadingRegistration) return;

    setLoadingRegistration(true);
    const formData = new FormData();
    formData.append("first_name", regFormData.firstName);
    formData.append("last_name", regFormData.lastName);
    formData.append("known_as", regFormData.knownAs || "");
    formData.append("address", regFormData.address || "");
    formData.append("phone_number", regFormData.phoneNumber);
    formData.append("unit", regFormData.unit);
    formData.append("reason_for_visit", regFormData.reasonForVisit);
    formData.append("type", regFormData.visitorType);
    formData.append("company_name", regFormData.companyName);
    formData.append(
  "mandatory_acknowledgment_taken", 
  isAgreementCheckedAdult ? 1 : 0 
);
    if (regFormData.photo) {
      formData.append("photo", regFormData.photo);
    }

    const validDependents = regDependents.filter(
      (dep) => dep.full_name.trim() !== ""
    );
    if (validDependents.length > 0) {
      formData.append("additional_dependents", JSON.stringify(validDependents));
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/register-visitor`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to register new visitor.");
      }

      setMessage("Visitor registered & signed in successfully!");
      setMessageType("success");
      // Reset form state and UI
      setTimeout(() => {
        setRegFormData(initialRegistrationForm);
        setRegDependents([]);
        setPhotoPreviewUrl(null);
        setIsAgreementCheckedAdult(false)
        setIsAgreementCheckedChild(false)
        handleCancelAction(); // Go back to dashboard
      }, 4000);

      fetchVisitors(); // Refresh the list
    } catch (err) {
      console.error("Registration Error:", err.message);
      showNotification(`Registration Failed: ${err.message}`, "error");
    } finally {
      setLoadingRegistration(false);
    }
  };

  // --- VisitorDetailsForm Handlers ---

  // 1.Handle Log In
  const handleLogin = async (id) => {
    if (!id || !selectedVisitor) return;
    if (selectedVisitor.is_banned === 1) {
      showNotification(
        "Visitor is banned and cannot check in. Please unban first.",
        "error"
      );
      return;
    }
    // Check if the visitor is already signed in (if their ID exists in the active visitors list)
    const isAlreadySignedIn = visitors.some(
      (activeVisitor) => activeVisitor.id === id
    );

    if (isAlreadySignedIn) {
      showNotification(
        `${selectedVisitor.first_name} is already signed in! Cannot sign in again.`,
        "error"
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Login failed.");
      }

      showNotification(result.message, "success");
      setTimeout(() => {
        handleCancelAction();
        fetchVisitors();
      }, 3000);
    } catch (err) {
      console.error("Login Error:", err.message);
      showNotification(`Login Failed: ${err.message}`, "error");
    }
  };

  // 2.Handle Update Details & Log In (Re-register)
  const handleUpdateAndLogin = async () => {
    if (!selectedVisitor) return;
    if (selectedVisitor.is_banned === 1) {
      showNotification(
        "Visitor is banned and cannot sign in. Please unban first.",
        "error"
      );
      return;
    }
    // Check if the visitor is already signed in before allowing the update & log-in.
    const isAlreadySignedIn = visitors.some(
      (activeVisitor) => activeVisitor.id === selectedVisitor.id
    );

    if (isAlreadySignedIn) {
      showNotification(
        `${selectedVisitor.first_name} is already signed in! Sign them out first to log in again.`,
        "error"
      );

      return;
    }
    const cleanedDependents = (editFormData.additional_dependents || []).filter(
      (dep) => dep.full_name && dep.full_name.trim() !== ""
    );
    const dataToSend = {
      id: selectedVisitor.id,
      known_as: editFormData.known_as,
      address: editFormData.address,
      phone_number: editFormData.phone_number,
      unit: editFormData.unit,
      reason_for_visit: editFormData.reason_for_visit,
      type: editFormData.type,
      company_name: editFormData.company_name,
      mandatory_acknowledgment_taken: isAgreementCheckedAdult ? 1 : 0 ,
      additional_dependents: JSON.stringify(cleanedDependents),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/update-visitor-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Update and sign failed.");
      }

      showNotification(result.message);
      setTimeout(() => {
        handleCancelAction();
        fetchVisitors();
      }, 2000);
    } catch (err) {
      console.error("Update & Login Error:", err.message);
      showNotification(`Update & sign Failed: ${err.message}`, "error");
    }
  };

  // 3.Handle Ban Visitor
  const handleBan = async (id) => {
    if (!id) return;
    const isCurrentlySignedIn = visitors.some(
      (activeVisitor) => activeVisitor.id === id
    );
    try {
      const response = await fetch(`${API_BASE_URL}/api/ban-visitor/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to ban visitor.");
      }
      if (isCurrentlySignedIn) {
        await handleVisitorLogout(id);
      }
      showNotification(result.message, "error");
      setSelectedVisitor((prev) => (prev ? { ...prev, is_banned: 1 } : null)); // Update local state
      setTimeout(() => {
        handleCancelAction();
        fetchVisitors();
      }, 3000);
    } catch (err) {
      console.error("Ban Error:", err.message);
      showNotification(`Ban Failed: ${err.message}`, "error");
    }
  };

  // The first function that will handle the unban password.
  const handleUnbanClick = (id) => {
    setPassword("");
    setMessage("");
    setModalContext({
      type: "unban",
      visitorId: id,
      title: "Confirm Unban Action",
      description:
        "Enter the Admin Password to authorize unbanning this visitor.",
      submitText: "Authorize Unban",
      submitColor: "bg-red-600 hover:bg-red-700",
    });
    setShowPasswordModal(true);
  };

  // The second function to handle showing the modal for viewing history
  const handleViewHistoryClick = () => {
    setPassword("");
    setMessage(""); 
    setModalContext({
      type: "viewHistory",
      visitorId: null,
      title: "Access Visitor History",
      description:
        "Enter the Authorization Password to view all historical records.",
      submitText: "Access Records",
    });
    setShowPasswordModal(true);
  };
  // Using a Universal function that will handle boths logics unban and view history data.
  const EnterPassword = async (e) => {
    e.preventDefault();
    const currentAction = modalContext.type;
    const currentId = modalContext.visitorId;

    if (!password) {
      showNotification("Password is required.", "error");
      return;
    } // --- 1. HANDLE UNBAN LOGIC ---

    if (currentAction === "unban") {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/unban-visitor/${currentId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Failed to unban visitor.");
        }

        showNotification(result.message, "success");
        setShowPasswordModal(false);
        setSelectedVisitor((prev) => (prev ? { ...prev, is_banned: 0 } : null));
        fetchVisitors();
      } catch (err) {
        console.error("Unban Error:", err.message);
        showNotification(`Unban Failed: ${err.message}`, "error");
        setPassword("");
        return;
      }
    }
    // --- 2. HANDLE VIEW HISTORY LOGIC ---
    else if (currentAction === "viewHistory") {
      //  Password check for history data
      try {
        const response = await fetch(`${API_BASE_URL}/api/authorize-history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "History access denied.");
        }
        setShowPasswordModal(false);
        setShowHistory(true);
        setSelectedVisitor(null);
        setShowRegistration(false);
        setSearchResults([]);

        showNotification("History access granted. Loading data...", "blue");
        fetchHistoryRecords("", "", "");
      } catch (err) {
        console.error("History Access Error:", err.message);
        showNotification(`Access Denied: ${err.message}`, "error");
        setPassword("");
        return;
      }
    }

    setPassword("");
    setModalContext({
      type: null,
      visitorId: null,
      title: "",
      description: "",
      submitText: "",
    });
  };

  // handle correcting the entry time
  const handleRecordMissedVisitClick = () => {
       // Check if the visitor is already signed in before allowing the correct missed entry time.
    const isAlreadySignedIn = visitors.some(
      (activeVisitor) => activeVisitor.id === selectedVisitor.id
    );

    if (isAlreadySignedIn) {
      showNotification(
        `${selectedVisitor.first_name} is already signed in!`,
        "error"
      );
      return;
    }
    if (!selectedVisitor) return;
    setMissedEntryTime("");
    setShowMissedVisitModal(true);
    setMessage("");
  };

  const confirmRecordMissedVisit = async () => {
    const visitorId = selectedVisitor?.id;
 
    if (!missedEntryTime) {
      showNotification("Entry time is required.", "error");
      return;
    }

    setShowMissedVisitModal(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/record-missed-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          pastEntryTime: new Date(missedEntryTime).toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to record missed visit.");
      }

      showNotification(result.message, "success");
      setTimeout(() => {
        handleCancelAction(); // Go back to the dashboard after success
      }, 3000);
    } catch (err) {
      console.error("Missed Visit Error:", err.message);
      showNotification(`${err.message}`, "error");
    }
  };


  // 6. Sign Out (From Dashboard)
  const handleVisitorLogout = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exit-visitor/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to sign out visitor.");
      }

      showNotification(result.message, "success");
      fetchVisitors();
    } catch (err) {
      console.error("Logout Error:", err.message);
      showNotification(`Logout Failed: ${err.message}`, "error");
    }
  };

  // --- HISTORY DATA LOGIC ---

  // Helper function to calculate duration between two dates
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start) || isNaN(end)) return "Invalid Date";

    const diffInMilliseconds = Math.abs(end - start);

    const hours = Math.floor(diffInMilliseconds / (1000 * 60 * 60));
    const minutes = Math.floor(
      (diffInMilliseconds % (1000 * 60 * 60)) / (1000 * 60)
    );

    let durationString = "";
    if (hours > 0) durationString += `${hours}h `;
    durationString += `${minutes}m`;

    return durationString.trim();
  };

  // Function to fetch history records based on filters
  const fetchHistoryRecords = async (query = "", start = "", end = "") => {
    setHistoryLoading(true);

    try {
      const url = new URL(`${API_BASE_URL}/api/history`);
      if (query) url.searchParams.append("query", query);
      if (start) url.searchParams.append("endDate", start);
      if (end) url.searchParams.append("endDate", end);

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      // Mapping the received data
      let fetchedRecords = data.map((record) => {
        return {
          id: record.id,
          ...record,
          entry_time: record.entry_time ? new Date(record.entry_time) : null,
          exit_time: record.exit_time ? new Date(record.exit_time) : null,
          duration_string:
            calculateDuration(record.entry_time, record.exit_time) || "Pending",
          dependents:
            typeof record.dependents === "string" &&
            record.dependents.length > 0
              ? JSON.parse(record.dependents)
              : record.dependents || [],
        };
      });

      setHistoryData(fetchedRecords);
      setFilteredHistoryData(fetchedRecords);
      showNotification(
        `History fetch complete. Found ${fetchedRecords.length} records.`,
        "success"
      );
    } catch (e) {
      console.error("Error fetching history records:", e.message);
      showNotification(`Failed to fetch history: ${e.message}`, "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handler to trigger filter application on local data
  const handleApplyFilters = () => {
    let recordsToFilter = [...historyData];

    // 2. Filter by Name/Query
    const query = historySearchQuery.trim().toLowerCase();
    if (query) {
      recordsToFilter = recordsToFilter.filter(
        (record) =>
          (record.first_name + " " + record.last_name)
            .toLowerCase()
            .includes(query) ||
          record.first_name.toLowerCase().includes(query) ||
          record.last_name.toLowerCase().includes(query)
      );
    }

    // 3. Filter by Date Range (Entry Time)
    const start = historyStartDate ? new Date(historyStartDate) : null;
    const end = historyEndDate ? new Date(historyEndDate) : null;

    if (start || end) {
      recordsToFilter = recordsToFilter.filter((record) => {
        const entryTime = record.entry_time;

        if (!entryTime) return false;

        let isAfterStart = true;
        if (start) {
          // Checking if entry is AFTER or EQUAL TO the start date (at midnight)
          isAfterStart = entryTime.getTime() >= start.getTime();
        }

        let isBeforeEnd = true;
        if (end) {
          // Check if entry is BEFORE or EQUAL TO the end date (at 23:59:59)
          const dayAfterEnd = new Date(end);
          dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
          isBeforeEnd = entryTime.getTime() < dayAfterEnd.getTime();
        }

        return isAfterStart && isBeforeEnd;
      });
    }

    // 4. Update the state variable used for rendering
    setFilteredHistoryData(recordsToFilter);
    showNotification(
      `Filtered data applied. Found ${recordsToFilter.length} records.`,
      "blue"
    );
  };

  // Handler to clear all filters and re-fetch all data
  const handleClearFilters = () => {
    setHistorySearchQuery("");
    setHistoryStartDate("");
    setHistoryEndDate("");
    fetchHistoryRecords("", "", "");
    setSortConfig({ key: "entry_time", direction: "descending" });
    showNotification("Filters cleared. Loading all history...", "blue");
  };

  // --- Sorting Handler
  const handleRequestSort = useCallback(
    (key) => {
      let direction = "ascending";
      if (sortConfig.key === key && sortConfig.direction === "ascending") {
        direction = "descending";
      }
      setSortConfig({ key, direction });
    },
    [sortConfig]
  );

  // handle the print function
  const handlePrintTable = () => {
    window.print();
    showNotification(
      "Print/PDF dialog opened. Ensure the history table is visible.",
      "blue"
    );
  };

  // Determine which view to show
  const showDashboard = !selectedVisitor && !showRegistration;
  const showHistoryView = showHistory && !selectedVisitor && !showRegistration;
  const sortedHistoryData = sortData(filteredHistoryData, sortConfig);

  return (
    <div className="font-sans min-h-screen bg-blue-200 text-gray-800 p-4 md:p-8 flex flex-col items-center">
      <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
      body { font-family: 'Inter', sans-serif; }
    `}</style>
      <script src="https://cdn.tailwindcss.com"></script>

      {/* Header */}
      <div className="flex flex-col items-center w-full mb-8 relative">
        <img
      src="salvation-army-logo.png"
      alt="The Salvation Army Red Shield Logo"
      className="absolute left-0 top-0 w-28 h-28 object-contain print-show-logo"
      // Fallback in case the image path is broken
      onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/96x96/DA251C/ffffff?text=TSA'; }}
    />
        <h1 className="text-4xl font-extrabold text-blue-800 mb-2">
          The Salvation Army Social Services
        </h1>
        <p className="text-lg text-blue-950 mb-4">
          Catherine Booth House Visitors Tracking
        </p>
        <button
          onClick={() => {
            const newState = !showHistory;
            if (newState) {
              handleViewHistoryClick();
            } else {
              setShowHistory(false);
              setSelectedVisitor(null);
              setShowRegistration(false);
              setSearchResults([]);
              showNotification("Back to current visitors dashboard.", "blue");
            }
          }}
          className="absolute top-0 right-0 min-w-[100px] py-2 px-4 bg-indigo-600 text-white text-sm rounded-lg shadow-xl hover:bg-indigo-700 transition-colors"
        >
          {showHistory ? "Show Dashboard" : "View Historical Data"}
        </button>

        {/* Button Group for View Switching */}
        {!showHistory && !showRegistration && (
          <div className="flex min-w-[200px] justify-center mt-4">
            <button
              onClick={() => {
                setShowRegistration(!showRegistration);
                setSelectedVisitor(null);
                setSearchResults([]);
                setShowHistory(false);
                showNotification(
                  showRegistration
                    ? "Back to Dashboard"
                    : "Registration Mode Activated",
                  "blue"
                );
              }}
              className="flex-1 min-w-[200px] py-3 px-4 bg-purple-600 text-white font-semibold rounded-lg shadow-xl hover:bg-purple-700 transition-colors"
            >
              {showRegistration ? "Show Dashboard" : "Register New Visitor"}
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl mx-auto">
        {/* Dashboard View */}
        {!showRegistration && !showHistory && !selectedVisitor && (
          <VisitorsDashboard
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            handleSearchInput={handleSearchInput}
            loadingDashboard={isLoading}
            message={message}
            messageType={messageType}
            searchResults={searchResults}
            handleVisitorSelect={handleVisitorSelect}
            loadingInSite={isLoading && visitors.length === 0}
            errorInSite={error}
            visitors={visitors}
            handleExit={handleVisitorLogout}
          />
        )}

        {/* Visitor Details/Log In View */}
        {selectedVisitor && (
          <VisitorDetailsForm
            selectedVisitor={selectedVisitor}
            editFormData={editFormData}
            setEditFormData={setEditFormData}
            handleLogin={handleLogin}
            handleUpdate={handleUpdateAndLogin}
            isAgreementCheckedAdult={isAgreementCheckedAdult} 
            setIsAgreementCheckedAdult={setIsAgreementCheckedAdult}
            isAgreementCheckedChild={isAgreementCheckedChild}
            setIsAgreementCheckedChild={setIsAgreementCheckedChild}
            handleBan={handleBan}
            handleUnbanClick={handleUnbanClick}
            handleRecordMissedVisitClick={handleRecordMissedVisitClick}
            handleCancelLogIn={handleCancelAction}
            message={message}
            messageType={messageType}
          />
        )}

        {/* Registration View */}
        {showRegistration && (
          <VisitorRegistrationForm
            message={message}
            messageType={messageType}
            formData={regFormData}
            handleInputChange={handleRegInputChange}
            handlePhotoChange={handlePhotoChange}
            photoPreviewUrl={photoPreviewUrl}
            dependents={regDependents}
            handleDependentChange={handleDependentChange}
            handleRemoveDependent={handleRemoveDependent}
            handleAddDependent={handleAddDependent}
            isAgreementCheckedAdult={isAgreementCheckedAdult}
            setIsAgreementCheckedAdult={setIsAgreementCheckedAdult}
            isAgreementCheckedChild={isAgreementCheckedChild}
            setIsAgreementCheckedChild={setIsAgreementCheckedChild}
            handleSubmit={handleNewVisitorRegistration}
            loadingRegistration={loadingRegistration}
            handleCancelRegistration={handleCancelAction}
          />
        )}

        {/* History View*/}
        {showHistory && (
          <HistoryDashboard
            data={sortedHistoryData}
            loading={historyLoading}
            searchQuery={historySearchQuery}
            startDate={historyStartDate}
            endDate={historyEndDate}
            sortConfig={sortConfig}
            onSearchChange={setHistorySearchQuery}
            onStartDateChange={setHistoryStartDate}
            onEndDateChange={setHistoryEndDate}
            onApplyFilters={handleApplyFilters}
            onClearFilters={handleClearFilters}
            onExportData={handlePrintTable}
            onRequestSort={handleRequestSort}
            statusMessage={message}
            isOnline={messageType !== "error"}
          />
        )}
      </div>

      {/* Password Modal (Always rendered but hidden by state) */}
      <PasswordModal
        showPasswordModal={showPasswordModal}
        EnterPassword={EnterPassword}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        password={password}
        message={message}
        messageType={messageType}
        setShowPasswordModal={setShowPasswordModal}
        modalTitle={modalContext.title}
        modalDescription={modalContext.description}
        submitButtonText={modalContext.submitText}
      />

      {/* Missed Visit Correction Modal (Always rendered but hidden by state) */}
      <RecordMissedVisitModal
        showModal={showMissedVisitModal}
        setShowModal={setShowMissedVisitModal}
        entryTime={missedEntryTime}
        setEntryTime={setMissedEntryTime}
        confirmAction={confirmRecordMissedVisit}
      />
    </div>
  );
}

export default App;
