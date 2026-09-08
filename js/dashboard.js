// ==========================================
// DOCTOR DASHBOARD LOGIC (dashboard.js)
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    const configAlert = document.getElementById("configAlert");
    const loginState = document.getElementById("loginState");
    const dashboardState = document.getElementById("dashboardState");
    const logoutBtn = document.getElementById("logoutBtn");
    const loginForm = document.getElementById("loginForm");
    const loginAlert = document.getElementById("loginAlert");
    const loginBtn = document.getElementById("loginBtn");
    const loginBtnText = document.getElementById("loginBtnText");
    
    const tableBody = document.getElementById("tableBody");
    const emptyState = document.getElementById("emptyState");
    const emptyStateText = document.getElementById("emptyStateText");
    const appointmentsTable = document.getElementById("appointmentsTable");

    const filterDate = document.getElementById("filterDate");
    const clearDateBtn = document.getElementById("clearDateBtn");
    const filterStatus = document.getElementById("filterStatus");
    const filterSearch = document.getElementById("filterSearch");

    const statTotal = document.getElementById("statTotal");
    const statPending = document.getElementById("statPending");
    const statConfirmed = document.getElementById("statConfirmed");
    const statCompleted = document.getElementById("statCompleted");

    let allAppointments = []; // In-memory store for instant client-side filtering

    // 1. Check if Supabase keys are configured
    if (!isSupabaseConfigured()) {
        configAlert.classList.add("active");
    }

    // Helper: Show Login Error
    function showLoginError(msg) {
        loginAlert.textContent = msg;
        loginAlert.classList.add("active");
    }

    function hideLoginError() {
        loginAlert.textContent = "";
        loginAlert.classList.remove("active");
    }

    function setLoginLoading(isLoading) {
        if (isLoading) {
            loginBtn.disabled = true;
            loginBtn.classList.add("loading");
            loginBtnText.textContent = "Authenticating...";
        } else {
            loginBtn.disabled = false;
            loginBtn.classList.remove("loading");
            loginBtnText.textContent = "Login";
        }
    }

    const doctorWelcomeTitle = document.getElementById("doctorWelcomeTitle");
    const doctorWelcomeSubtitle = document.getElementById("doctorWelcomeSubtitle");

    let currentDoctor = null;

    // Helper: Lookup Doctor Profile in 'doctors' table by Email
    async function loadDoctorProfile(email) {
        if (!supabaseClient || !email) return null;

        try {
            const cleanEmail = email.trim().toLowerCase();
            
            // 1. Case-insensitive search using ilike
            let { data, error } = await supabaseClient
                .from("doctors")
                .select("*")
                .ilike("email", cleanEmail)
                .limit(1);

            if (data && data.length > 0) return data[0];

            // 2. Exact match fallback
            const retryRes = await supabaseClient
                .from("doctors")
                .select("*")
                .eq("email", email.trim())
                .limit(1);

            if (retryRes.data && retryRes.data.length > 0) return retryRes.data[0];

            return null;

        } catch (err) {
            console.error("Error loading doctor profile from Supabase:", err);
            return null;
        }
    }


    function updateDoctorHeader(doc) {
        if (!doc) {
            if (doctorWelcomeTitle) doctorWelcomeTitle.textContent = "Appointment Schedule Dashboard";
            if (doctorWelcomeSubtitle) doctorWelcomeSubtitle.textContent = "Manage and update patient appointments in real-time.";
            return;
        }
        let cleanName = String(doc.name || "").trim();
        if (!/^dr\.?\s+/i.test(cleanName)) {
            cleanName = "Dr. " + cleanName;
        }
        if (doctorWelcomeTitle) {
            doctorWelcomeTitle.textContent = `Welcome, ${cleanName}`;
        }
        if (doctorWelcomeSubtitle) {
            const spec = doc.specialization ? ` | Specialization: ${doc.specialization}` : "";
            doctorWelcomeSubtitle.textContent = `Doctor Dashboard${spec}`;
        }
    }

    // 2. Auth State Observer & Initial Session Check (Direct URL Access Protection)
    async function checkAuthSession() {
        if (!isSupabaseConfigured() || !supabaseClient) {
            showLoginState();
            return;
        }

        try {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (session && session.user && session.user.email) {
                const docProfile = await loadDoctorProfile(session.user.email);
                if (docProfile) {
                    currentDoctor = docProfile;
                    sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                    updateDoctorHeader(currentDoctor);
                    showDashboardState();
                    fetchAppointments(currentDoctor.id);
                } else {
                    // Profile missing -> Logout & show login form
                    await supabaseClient.auth.signOut();
                    clearAllStoredData();
                    showLoginState();
                    showLoginError("Doctor profile not found in clinic records. Please contact the administrator.");
                }
            } else {
                // No active session -> Show empty login form
                clearAllStoredData();
                showLoginState();
            }
        } catch (err) {
            console.error("Session check failed:", err);
            clearAllStoredData();
            showLoginState();
        }
    }

    // Helper: Clear all stored session & local data
    function clearAllStoredData() {
        sessionStorage.clear();
        localStorage.clear();
        sessionStorage.removeItem("loggedInDoctor");
        localStorage.removeItem("loggedInDoctor");
        currentDoctor = null;
        allAppointments = [];
    }

    // Listen for Auth Changes (Sign-in / Sign-out)
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user && session.user.email) {
                const docProfile = await loadDoctorProfile(session.user.email);
                if (docProfile) {
                    currentDoctor = docProfile;
                    sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                    updateDoctorHeader(currentDoctor);
                    showDashboardState();
                    fetchAppointments(currentDoctor.id);
                } else {
                    clearAllStoredData();
                    showLoginState();
                }
            } else {
                clearAllStoredData();
                showLoginState();
            }
        });
    }

    function showLoginState() {
        // Manually clear email and password fields
        const emailInput = document.getElementById("doctorEmail");
        const passInput = document.getElementById("doctorPassword");
        if (emailInput) emailInput.value = "";
        if (passInput) passInput.value = "";
        if (loginForm) loginForm.reset();

        loginState.style.display = "block";
        dashboardState.style.display = "none";
        logoutBtn.style.display = "none";
    }

    function showDashboardState() {
        loginState.style.display = "none";
        dashboardState.style.display = "block";
        logoutBtn.style.display = "inline-flex";
    }

    // 3. Login Form Submit Handler (Strict Supabase Auth Verification)
    if (loginForm) {
        loginForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            hideLoginError();

            // Clear any old session state on fresh login attempt
            clearAllStoredData();

            if (!isSupabaseConfigured() || !supabaseClient) {
                showLoginError("Supabase configuration missing in config.js!");
                return;
            }

            const email = document.getElementById("doctorEmail").value.trim();
            const password = document.getElementById("doctorPassword").value.trim();

            if (!email || !password) {
                showLoginError("Please enter both email and password.");
                return;
            }

            setLoginLoading(true);

            try {
                // STEP 1: Strict Supabase Auth Login (Verifies password with Supabase Auth)
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                // If password or email is invalid, STOP immediately and show error
                if (error || !data || !data.user) {
                    console.error("Login Auth Error:", error);
                    throw new Error("Invalid email or password. Please try again.");
                }

                // STEP 2: Fetch Doctor Record from 'doctors' table only after Auth succeeds
                const docProfile = await loadDoctorProfile(data.user.email || email);
                if (!docProfile) {
                    await supabaseClient.auth.signOut();
                    throw new Error("Doctor profile not found in clinic records. Please contact the administrator.");
                }

                // STEP 3: Authentication & Profile Verified -> Open Dashboard
                currentDoctor = docProfile;
                sessionStorage.setItem("loggedInDoctor", JSON.stringify(currentDoctor));
                updateDoctorHeader(currentDoctor);
                showDashboardState();
                fetchAppointments(currentDoctor.id);

                if (typeof showToast === "function") {
                    showToast(`Logged in successfully as ${currentDoctor.name}!`, "success");
                }

            } catch (err) {
                showLoginError(err.message || "Invalid email or password. Please try again.");
            } finally {
                setLoginLoading(false);
            }
        });
    }

    // 4. Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            // STEP 1: Execute Supabase Auth signOut()
            if (supabaseClient) {
                try {
                    await supabaseClient.auth.signOut();
                } catch (e) {
                    console.warn("SignOut error:", e);
                }
            }

            // STEP 2: Clear all stored session/local data and variables
            clearAllStoredData();
            hideLoginError();

            // STEP 3: Reset header text
            updateDoctorHeader(null);

            // STEP 4: Show empty login state (clears email and password fields)
            showLoginState();

            if (typeof showToast === "function") {
                showToast("Logged out successfully.", "info");
            }
        });
    }




    // 5. Fetch Appointments from Supabase Database (Doctor-wise filter)
    async function fetchAppointments(doctorId) {
        if (!supabaseClient) return;

        try {
            const targetDoctorId = doctorId || (currentDoctor ? currentDoctor.id : null);
            let query = supabaseClient.from("appointments").select("*").order("appointment_date", { ascending: true });

            // Filter strictly by doctor_id if doctor is logged in
            if (targetDoctorId) {
                query = query.eq("doctor_id", targetDoctorId);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching appointments:", error);
                alert("Failed to fetch appointments: " + error.message);
                return;
            }

            allAppointments = data || [];
            updateStats(allAppointments);
            applyFilters();

        } catch (err) {
            console.error("Fetch Exception:", err);
        }
    }

    // Update Overview Stats Cards
    function updateStats(appointmentsList) {
        statTotal.textContent = appointmentsList.length;
        statPending.textContent = appointmentsList.filter(a => a.status === 'Pending').length;
        statConfirmed.textContent = appointmentsList.filter(a => a.status === 'Confirmed').length;
        statCompleted.textContent = appointmentsList.filter(a => a.status === 'Completed').length;
    }

    // 6. Combined Filter Logic (Date + Status + Patient Name Search)
    function applyFilters() {
        const dateVal = filterDate ? filterDate.value : "";
        const statusVal = filterStatus ? filterStatus.value : "";
        const searchVal = filterSearch ? filterSearch.value.toLowerCase().trim() : "";

        const filtered = allAppointments.filter(item => {
            // 1. Date Filter
            if (dateVal && item.appointment_date !== dateVal) {
                return false;
            }

            // 2. Status Filter
            if (statusVal && statusVal !== "All" && item.status !== statusVal) {
                return false;
            }

            // 3. Search Filter (patient_name case-insensitive partial match & mobile match)
            if (searchVal) {
                const name = (item.patient_name || "").toLowerCase();
                const mobile = (item.mobile || "").toLowerCase();
                if (!name.includes(searchVal) && !mobile.includes(searchVal)) {
                    return false;
                }
            }

            return true;
        });

        renderTable(filtered);
    }

    // Event Listeners for Filters
    if (filterDate) filterDate.addEventListener("change", applyFilters);
    if (filterStatus) filterStatus.addEventListener("change", applyFilters);
    if (filterSearch) filterSearch.addEventListener("input", applyFilters);
    if (clearDateBtn) {
        clearDateBtn.addEventListener("click", function () {
            if (filterDate) filterDate.value = "";
            applyFilters();
        });
    }

    // 7. Render Appointments Table
    function renderTable(list) {
        tableBody.innerHTML = "";

        if (!list || list.length === 0) {
            if (appointmentsTable) appointmentsTable.style.display = "none";
            emptyState.style.display = "block";
            if (emptyStateText) {
                if (allAppointments.length === 0) {
                    emptyStateText.textContent = "No appointments found.";
                } else {
                    emptyStateText.textContent = "No appointments found matching this filter.";
                }
            }
            return;
        }

        if (appointmentsTable) appointmentsTable.style.display = "table";
        emptyState.style.display = "none";

        list.forEach((item, index) => {
            const tr = document.createElement("tr");

            // Doctor Report Upload Column Logic
            const reportInputId = `doctorReportInput-${item.id}`;
            const dropdownId = `doctorReportDropdown-${item.id}`;
            const existingReportUrls = item.doctor_report_url 
                ? String(item.doctor_report_url).split(",").map(u => u.trim()).filter(Boolean) 
                : [];

            let reportDropdownHtml = "";
            if (existingReportUrls.length > 0) {
                const reportItemsHtml = existingReportUrls.map((rUrl, rIndex) => {
                    const label = existingReportUrls.length > 1 ? `Report ${rIndex + 1}` : `Report`;
                    return `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #f1f5f9; background: white;">
                            <button type="button" onclick="if(typeof viewPatientDocument==='function'){viewPatientDocument('${escapeHtml(rUrl)}', '${escapeHtml(item.patient_name)}_Report_${rIndex+1}')}else{window.open('${escapeHtml(rUrl)}', '_blank')}" style="padding: 4px 8px; font-size: 0.76rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; flex: 1; text-align: left;" title="View report file">
                                👁️ ${label}
                            </button>
                            <button type="button" class="btn-delete-doctor-report" data-id="${item.id}" data-index="${rIndex}" style="padding: 4px 6px; font-size: 0.8rem; background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; border-radius: 5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;" title="Delete this report">
                                🗑️
                            </button>
                        </div>
                    `;
                }).join("");

                reportDropdownHtml = `
                    <div style="position: relative; display: inline-block;">
                        <button type="button" class="btn-toggle-reports-dropdown" data-target="${dropdownId}" style="padding: 5px 10px; font-size: 0.75rem; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: all 0.15s;">
                            📄 Reports (${existingReportUrls.length}) <span style="font-size: 0.65rem;">▾</span>
                        </button>
                        <div id="${dropdownId}" class="reports-dropdown-menu" style="display: none; position: absolute; right: 0; top: calc(100% + 4px); background: white; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); width: 195px; z-index: 99; overflow: hidden;">
                            ${reportItemsHtml}
                        </div>
                    </div>
                `;
            }

            const uploadBtnLabel = existingReportUrls.length > 0 ? "➕ Add Report" : "📤 Upload Report";

            let doctorReportHtml = `
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    <input type="file" id="${reportInputId}" accept="image/jpeg,image/png,image/jpg,.pdf" style="display:none;" data-id="${item.id}">
                    <button type="button" class="btn-upload-doctor-report" data-input-id="${reportInputId}" style="padding: 5px 10px; font-size: 0.75rem; background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(15, 118, 110, 0.2); white-space: nowrap;">
                        ${uploadBtnLabel}
                    </button>
                    ${reportDropdownHtml}
                </div>
            `;

            // Date formatting
            const formattedDate = item.appointment_date || "-";
            const formattedTime = (typeof formatTime12Hour === "function") ? formatTime12Hour(item.appointment_time) : (item.appointment_time || "-");

            let genderDisplay = item.gender || '-';
            let issueDisplay = item.issue || '-';
            if (genderDisplay === '-' && issueDisplay.includes('[Gender: ')) {
                const match = issueDisplay.match(/\[Gender:\s*([^\]]+)\]/);
                if (match) {
                    genderDisplay = match[1];
                    issueDisplay = issueDisplay.replace(/\[Gender:\s*([^\]]+)\]/, '').trim();
                }
            }

            tr.innerHTML = `
                <td style="font-weight: 600; color: #64748b;">${index + 1}</td>
                <td><strong>${escapeHtml(item.patient_name)}</strong></td>
                <td>${item.age || '-'}</td>
                <td>${escapeHtml(genderDisplay)}</td>
                <td>${escapeHtml(item.mobile || '-')}</td>
                <td style="max-width:220px; word-wrap:break-word;">${escapeHtml(issueDisplay)}</td>
                <td>${doctorReportHtml}</td>
                <td>${formattedDate}</td>
                <td>${formattedTime}</td>
                <td>
                    <select class="status-select ${item.status || 'Pending'}" data-id="${item.id}">
                        <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Confirmed" ${item.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="Completed" ${item.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        <option value="Cancelled" ${item.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            `;

            tableBody.appendChild(tr);
        });

        // Attach click listeners to toggle Reports Dropdowns
        document.querySelectorAll(".btn-toggle-reports-dropdown").forEach(btn => {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const targetId = this.getAttribute("data-target");
                const targetMenu = document.getElementById(targetId);
                
                // Hide all other open dropdown menus first
                document.querySelectorAll(".reports-dropdown-menu").forEach(menu => {
                    if (menu !== targetMenu) menu.style.display = "none";
                });

                if (targetMenu) {
                    targetMenu.style.display = (targetMenu.style.display === "none" || !targetMenu.style.display) ? "block" : "none";
                }
            });
        });

        // Close all dropdowns when clicking anywhere outside
        document.addEventListener("click", function () {
            document.querySelectorAll(".reports-dropdown-menu").forEach(menu => {
                menu.style.display = "none";
            });
        });

        // Attach click listener to Upload Report buttons
        document.querySelectorAll(".btn-upload-doctor-report").forEach(btn => {
            btn.addEventListener("click", function () {
                const inputId = this.getAttribute("data-input-id");
                const inputElem = document.getElementById(inputId);
                if (inputElem) inputElem.click();
            });
        });

        // Attach change listener to file inputs for Doctor Report Upload
        document.querySelectorAll("input[id^='doctorReportInput-']").forEach(fileInput => {
            fileInput.addEventListener("change", async function () {
                if (!this.files || !this.files[0]) return;
                const file = this.files[0];
                const appId = this.getAttribute("data-id");

                const maxSizeBytes = 5 * 1024 * 1024;
                if (file.size > maxSizeBytes) {
                    if (typeof showToast === "function") {
                        showToast(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 5MB.`, "error");
                    } else {
                        alert(`File size exceeds 5MB limit. Please select a smaller file.`);
                    }
                    this.value = "";
                    return;
                }

                const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
                const fileExt = (file.name.split('.').pop() || "").toLowerCase();
                const isAllowed = allowedTypes.includes(file.type) || ["pdf", "jpg", "jpeg", "png"].includes(fileExt);

                if (!isAllowed) {
                    if (typeof showToast === "function") {
                        showToast("Invalid file type. Only JPG, PNG images and PDF documents are allowed.", "error");
                    } else {
                        alert("Invalid file type. Only JPG, PNG images and PDF documents are allowed.");
                    }
                    this.value = "";
                    return;
                }

                if (typeof showToast === "function") {
                    showToast("Uploading Doctor Report...", "info");
                }

                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const filePath = `doc_report_${Date.now()}_${cleanFileName}`;

                    let mimeType = file.type;
                    if (!mimeType || mimeType === "application/octet-stream") {
                        mimeType = fileExt === "pdf" ? "application/pdf" : "image/jpeg";
                    }

                    const { data: storageData, error: uploadError } = await supabaseClient
                        .storage
                        .from("patient-documents")
                        .upload(filePath, file, {
                            cacheControl: "3600",
                            contentType: mimeType,
                            upsert: false
                        });

                    if (uploadError) {
                        console.error("Storage upload error:", uploadError);
                        let errStr = uploadError.message || "Storage upload failed";
                        throw new Error("Storage upload failed: " + errStr);
                    }

                    const { data: publicUrlData } = supabaseClient
                        .storage
                        .from("patient-documents")
                        .getPublicUrl(filePath);

                    const publicUrl = publicUrlData ? publicUrlData.publicUrl : null;

                    if (!publicUrl) {
                        throw new Error("Could not retrieve public URL for uploaded report.");
                    }

                    const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
                    const targetItem = allAppointments.find(a => String(a.id) === String(parsedId));
                    let currentUrls = [];
                    if (targetItem && targetItem.doctor_report_url) {
                        currentUrls = String(targetItem.doctor_report_url).split(",").map(u => u.trim()).filter(Boolean);
                    }
                    currentUrls.push(publicUrl);
                    const updatedDoctorReportUrl = currentUrls.join(", ");

                    const { error: dbError } = await supabaseClient
                        .from("appointments")
                        .update({ doctor_report_url: updatedDoctorReportUrl })
                        .eq("id", parsedId);

                    if (dbError) {
                        console.error("Database update error:", dbError);
                        throw new Error("Failed to save report URL to database: " + dbError.message);
                    }

                    if (typeof showToast === "function") {
                        showToast("Doctor Report uploaded successfully!", "success");
                    }

                    const doctorIdToRefresh = currentDoctor ? currentDoctor.id : null;
                    fetchAppointments(doctorIdToRefresh);

                } catch (err) {
                    console.error("Doctor Report Upload Exception:", err);
                    if (typeof showToast === "function") {
                        showToast("Error uploading report: " + err.message, "error");
                    } else {
                        alert("Error uploading report: " + err.message);
                    }
                } finally {
                    this.value = "";
                }
            });
        });

        // Attach click listener to Delete Report buttons
        document.querySelectorAll(".btn-delete-doctor-report").forEach(btn => {
            btn.addEventListener("click", async function () {
                const appId = this.getAttribute("data-id");
                const reportIndex = parseInt(this.getAttribute("data-index"), 10);

                if (!confirm("Are you sure you want to remove this doctor report file?")) return;

                try {
                    const parsedId = isNaN(Number(appId)) ? appId : Number(appId);
                    const targetItem = allAppointments.find(a => String(a.id) === String(parsedId));

                    if (!targetItem || !targetItem.doctor_report_url) return;

                    let currentUrls = String(targetItem.doctor_report_url).split(",").map(u => u.trim()).filter(Boolean);

                    if (reportIndex >= 0 && reportIndex < currentUrls.length) {
                        currentUrls.splice(reportIndex, 1);
                    }

                    const updatedDoctorReportUrl = currentUrls.length > 0 ? currentUrls.join(", ") : null;

                    const { error: dbError } = await supabaseClient
                        .from("appointments")
                        .update({ doctor_report_url: updatedDoctorReportUrl })
                        .eq("id", parsedId);

                    if (dbError) throw new Error("Failed to remove report file: " + dbError.message);

                    if (typeof showToast === "function") {
                        showToast("Doctor Report file removed successfully!", "success");
                    }

                    const doctorIdToRefresh = currentDoctor ? currentDoctor.id : null;
                    fetchAppointments(doctorIdToRefresh);

                } catch (err) {
                    console.error("Delete report error:", err);
                    if (typeof showToast === "function") {
                        showToast("Error removing report: " + err.message, "error");
                    } else {
                        alert("Error removing report: " + err.message);
                    }
                }
            });
        });

        // Attach event listener to status dropdowns
        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", handleStatusChange);
        });
    }

    // 8. Instant Status Update Handler (UPDATE query to Supabase)
    async function handleStatusChange(e) {
        const selectElem = e.target;
        const appointmentId = selectElem.getAttribute("data-id");
        const newStatus = selectElem.value;

        // Update class styling immediately
        selectElem.className = `status-select ${newStatus}`;

        try {
            const { data, error } = await supabaseClient
                .from("appointments")
                .update({ status: newStatus })
                .eq("id", appointmentId);

            if (error) {
                console.error("Status update error:", error);
                if (typeof showToast === "function") showToast("Failed to update status: " + error.message, "error");
                // Re-fetch to sync accurate data
                fetchAppointments();
                return;
            }

            if (typeof showToast === "function") {
                showToast(`Status updated to '${newStatus}'`, "success");
            }

            // Update in-memory item status, recalculate stats, and re-apply filters
            const targetItem = allAppointments.find(a => a.id == appointmentId);
            if (targetItem) {
                targetItem.status = newStatus;
                updateStats(allAppointments);
                applyFilters();
            }

        } catch (err) {
            console.error("Status Change Exception:", err);
            if (typeof showToast === "function") showToast("Status update error!", "error");
        }
    }

    // Helper: Escape HTML string to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 9. Supabase Realtime Subscription Setup
    function setupRealtimeDashboard() {
        if (!supabaseClient) return;

        // Listen to live changes in 'doctors' table (email, name, profile updates)
        supabaseClient
            .channel('dashboard-doctors-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, async (payload) => {
                console.log("Real-time doctor change detected:", payload);
                if (currentDoctor && (payload.new?.id === currentDoctor.id || payload.old?.id === currentDoctor.id)) {
                    if (payload.eventType === 'DELETE') {
                        if (typeof showToast === "function") showToast("Your doctor profile was deleted from Supabase.", "warning");
                        if (logoutBtn) logoutBtn.click();
                        return;
                    }
                    const oldEmail = currentDoctor.email;
                    currentDoctor = payload.new;
                    updateDoctorHeader(currentDoctor);
                    
                    if (payload.new && payload.new.email !== oldEmail) {
                        if (typeof showToast === "function") {
                            showToast(`📧 Doctor Email updated to '${payload.new.email}' in real-time!`, "success", 4500);
                        }
                    } else {
                        if (typeof showToast === "function") {
                            showToast("Doctor profile updated in real-time!", "info");
                        }
                    }
                }
            })
            .subscribe();


        // Listen to live changes in 'appointments' table (new bookings, status changes, cancellations)
        supabaseClient
            .channel('dashboard-appointments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
                console.log("Real-time appointment change detected:", payload);
                if (currentDoctor) {
                    const docId = currentDoctor.id;
                    const newDocId = payload.new?.doctor_id;
                    const oldDocId = payload.old?.doctor_id;

                    if (!newDocId || newDocId === docId || oldDocId === docId) {
                        fetchAppointments(docId);
                    }
                }
            })
            .subscribe();
    }

    // Initial session check & setup Realtime listeners
    checkAuthSession();
    setupRealtimeDashboard();
});

