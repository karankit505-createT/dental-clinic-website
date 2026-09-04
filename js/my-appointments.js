// ==========================================
// MY APPOINTMENTS LOGIC (my-appointments.js)
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    const configAlert = document.getElementById("configAlert");
    const lookupForm = document.getElementById("lookupForm");
    const mobileInput = document.getElementById("mobileNumber");
    const lookupAlert = document.getElementById("lookupAlert");
    const lookupBtn = document.getElementById("lookupBtn");
    const lookupBtnText = document.getElementById("lookupBtnText");
    const resultsContainer = document.getElementById("resultsContainer");
    const cardsList = document.getElementById("cardsList");
    const emptyState = document.getElementById("emptyState");
    const resultsCountText = document.getElementById("resultsCountText");

    const ALL_TIME_SLOTS = [
        "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
        "12:00 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM",
        "04:30 PM", "05:00 PM", "05:30 PM"
    ];

    function normalizeTime(t) {
        if (!t) return "";
        t = String(t).trim().toUpperCase();
        const match = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
        if (match) {
            let h = parseInt(match[1], 10);
            const m = match[2];
            let period = match[3];
            if (!period) {
                if (h === 0) { h = 12; period = "AM"; }
                else if (h < 12) { period = "AM"; }
                else if (h === 12) { period = "PM"; }
                else { h = h - 12; period = "PM"; }
            }
            const hStr = h < 10 ? "0" + h : "" + h;
            return `${hStr}:${m} ${period}`;
        }
        return t;
    }

    function generateSlotOptionsHtml(bookedSet = new Set(), selectedSlot = "") {
        let html = `<option value="" disabled ${!selectedSlot ? 'selected' : ''}>Select New Time Slot</option>`;
        ALL_TIME_SLOTS.forEach(slot => {
            const norm = normalizeTime(slot);
            const isBooked = bookedSet.has(norm) || bookedSet.has(slot);
            const isSelected = selectedSlot && (norm === normalizeTime(selectedSlot) || slot === selectedSlot);
            if (isBooked && !isSelected) {
                html += `<option value="${slot}" disabled>${slot} (Booked)</option>`;
            } else if (isSelected) {
                html += `<option value="${slot}" selected>${slot} (Current)</option>`;
            } else {
                html += `<option value="${slot}">${slot}</option>`;
            }
        });
        return html;
    }

    // 1. Check if Supabase keys are configured
    if (!isSupabaseConfigured()) {
        configAlert.classList.add("active");
    }

    let doctorsMap = {};

    // Pre-fetch doctors table to map doctor_id -> Doctor Name & Specialization
    async function loadDoctorsMap() {
        if (!supabaseClient) return;
        try {
            const { data } = await supabaseClient.from("doctors").select("id, name, specialization");
            if (data) {
                data.forEach(d => {
                    doctorsMap[d.id] = d;
                });
            }
        } catch (err) {
            console.warn("Could not pre-fetch doctors map:", err);
        }
    }

    loadDoctorsMap();

    function showError(msg) {
        lookupAlert.textContent = msg;
        lookupAlert.classList.add("active");
    }

    function hideError() {
        lookupAlert.textContent = "";
        lookupAlert.classList.remove("active");
    }

    function setLoading(isLoading) {
        if (isLoading) {
            lookupBtn.disabled = true;
            lookupBtn.classList.add("loading");
            lookupBtnText.textContent = "Checking Status...";
        } else {
            lookupBtn.disabled = false;
            lookupBtn.classList.remove("loading");
            lookupBtnText.textContent = "Check Status";
        }
    }

    // 2. Lookup Form Submit Handler
    lookupForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        hideError();

        if (!isSupabaseConfigured() || !supabaseClient) {
            showError("Supabase credentials missing! Please configure config.js with your SUPABASE_URL and SUPABASE_ANON_KEY.");
            return;
        }

        const mobile = mobileInput.value.trim();

        // 10-digit Mobile Validation
        const mobileRegex = /^\d{10}$/;
        if (!mobileRegex.test(mobile)) {
            showError("Please enter a valid 10-digit Mobile Number (e.g. 9876543210).");
            return;
        }

        setLoading(true);

        try {
            // Re-ensure doctors map is populated
            if (Object.keys(doctorsMap).length === 0) {
                await loadDoctorsMap();
            }

            // Query appointments matching the mobile number, joining doctors table if relationship exists
            let { data, error } = await supabaseClient
                .from("appointments")
                .select("*, doctors(id, name, specialization)")
                .eq("mobile", mobile)
                .order("appointment_date", { ascending: false });

            // If foreign key relationship query throws an error, fallback to standard select
            if (error) {
                console.warn("Fallback query without join:", error.message);
                const retryRes = await supabaseClient
                    .from("appointments")
                    .select("*")
                    .eq("mobile", mobile)
                    .order("appointment_date", { ascending: false });
                data = retryRes.data;
                error = retryRes.error;
            }

            if (error) {
                console.error("Fetch error:", error);
                throw new Error("Failed to fetch appointments: " + error.message);
            }

            renderAppointments(data || [], mobile);

        } catch (err) {
            console.error("Lookup Exception:", err);
            showError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    });

    // Helper: Clean and format doctor name (prevents duplicate "Dr. Dr.")
    function formatDoctorName(name, specialization) {
        if (!name) return "SmileCare Specialist";
        let cleanName = String(name).trim();
        if (!/^dr\.?\s+/i.test(cleanName)) {
            cleanName = "Dr. " + cleanName;
        }
        const spec = specialization ? ` (${specialization})` : "";
        return `${cleanName}${spec}`;
    }

    // 3. Render Appointments List Cards
    function renderAppointments(list, mobileNumber) {
        resultsContainer.style.display = "block";
        cardsList.innerHTML = "";

        if (!list || list.length === 0) {
            emptyState.style.display = "block";
            cardsList.style.display = "none";
            resultsCountText.textContent = `No appointments found for mobile number ${mobileNumber}`;
            return;
        }

        emptyState.style.display = "none";
        cardsList.style.display = "flex";
        resultsCountText.textContent = `Showing ${list.length} appointment(s) for mobile number ${mobileNumber}`;

        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "appointment-card";

            const status = item.status || "Pending";
            let genderDisplay = item.gender || "-";
            let issueDisplay = item.issue || "-";

            // Smart parse gender from issue if appended
            if (genderDisplay === "-" && issueDisplay.includes("[Gender: ")) {
                const match = issueDisplay.match(/\[Gender:\s*([^\]]+)\]/);
                if (match) {
                    genderDisplay = match[1];
                    issueDisplay = issueDisplay.replace(/\[Gender:\s*([^\]]+)\]/, "").trim();
                }
            }

            // Determine Doctor Name cleanly
            let doctorNameDisplay = "SmileCare Specialist";
            if (item.doctors && item.doctors.name) {
                doctorNameDisplay = formatDoctorName(item.doctors.name, item.doctors.specialization);
            } else if (item.doctor_id && doctorsMap[item.doctor_id]) {
                const doc = doctorsMap[item.doctor_id];
                doctorNameDisplay = formatDoctorName(doc.name, doc.specialization);
            } else if (item.doctor_name) {
                doctorNameDisplay = formatDoctorName(item.doctor_name);
            }

            // Document link
            let docHtml = "";
            if (item.document_url) {
                docHtml = `
                    <div class="card-detail-item">
                        <span class="card-detail-label">Attached Document</span>
                        <a href="${item.document_url}" target="_blank" class="doc-link" style="margin-top: 4px; display:inline-flex;" title="View attached document">
                            📄 View Document
                        </a>
                    </div>
                `;
            }

            const todayStr = new Date().toISOString().split("T")[0];

            // Cancel Button, Reschedule Button, and Status Notice Bar
            let actionHtml = "";
            const cancelBoxId = `cancelBox-${item.id || Math.random().toString(36).substr(2, 9)}`;
            const resBoxId = `resBox-${item.id || Math.random().toString(36).substr(2, 9)}`;
            const resDateId = `resDate-${item.id || Math.random().toString(36).substr(2, 9)}`;
            const resTimeId = `resTime-${item.id || Math.random().toString(36).substr(2, 9)}`;

            if (status === "Cancelled") {
                actionHtml = `<div class="card-action-bar"><span class="cancelled-info-badge">❌ Appointment Cancelled</span></div>`;
            } else if (status === "Completed") {
                actionHtml = `<div class="card-action-bar"><span class="completed-info-badge">✓ Appointment Completed</span></div>`;
            } else {
                actionHtml = `
                    <div class="card-action-bar" style="gap: 10px;">
                        <button type="button" class="btn-reschedule-appointment btn-res-trigger" data-target="${resBoxId}" data-id="${item.id}" data-doctor="${item.doctor_id || ''}" data-date-id="${resDateId}" data-time-id="${resTimeId}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                            </svg>
                            Reschedule
                        </button>
                        <button type="button" class="btn-cancel-appointment btn-cancel-trigger" data-target="${cancelBoxId}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                            Cancel Appointment
                        </button>
                    </div>

                    <!-- Cancel Confirmation Dialog -->
                    <div id="${cancelBoxId}" class="cancel-confirm-box">
                        <div class="cancel-confirm-text">⚠️ Are you sure you want to cancel your appointment for ${item.appointment_date || ''} at ${formatTime12Hour(item.appointment_time)}?</div>
                        <div class="confirm-btn-group">
                            <button type="button" class="btn-confirm-yes" 
                                    data-id="${item.id || ''}" 
                                    data-mobile="${escapeHtml(item.mobile)}" 
                                    data-date="${escapeHtml(item.appointment_date)}" 
                                    data-time="${escapeHtml(item.appointment_time)}">
                                Yes, Cancel Booking
                            </button>
                            <button type="button" class="btn-confirm-no" data-target="${cancelBoxId}">
                                No, Keep Booking
                            </button>
                        </div>
                    </div>

                    <!-- Reschedule Dialog Box -->
                    <div id="${resBoxId}" class="reschedule-card-box">
                        <div class="reschedule-title">
                            📅 Reschedule Appointment
                        </div>
                        <div class="form-group" style="margin-bottom: 12px;">
                            <label style="font-size:0.8rem;">Select New Date <span class="required-star">*</span></label>
                            <input type="date" id="${resDateId}" min="${todayStr}" value="${item.appointment_date || ''}">
                        </div>
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-size:0.8rem;">Select New Time Slot <span class="required-star">*</span></label>
                            <select id="${resTimeId}">
                                ${generateSlotOptionsHtml(new Set(), item.appointment_time)}
                            </select>
                        </div>
                        <div class="confirm-btn-group">
                            <button type="button" class="btn-submit btn-confirm-reschedule" 
                                    style="padding: 8px 16px; font-size: 0.85rem; width: auto;"
                                    data-id="${item.id || ''}" 
                                    data-mobile="${escapeHtml(item.mobile)}"
                                    data-date-id="${resDateId}" 
                                    data-time-id="${resTimeId}"
                                    data-box-id="${resBoxId}">
                                <span class="spinner" style="width: 14px; height: 14px;"></span>
                                Confirm Reschedule
                            </button>
                            <button type="button" class="btn-confirm-no" data-target="${resBoxId}">
                                Cancel
                            </button>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="appointment-card-header">
                    <div class="patient-name-title">👤 ${escapeHtml(item.patient_name)}</div>
                    <span class="status-badge ${status}">${status}</span>
                </div>

                <div class="card-details-grid">
                    <div class="card-detail-item">
                        <span class="card-detail-label">Assigned Doctor</span>
                        <span class="card-detail-value" style="color:var(--primary); font-weight:700;">🩺 ${escapeHtml(doctorNameDisplay)}</span>
                    </div>

                    <div class="card-detail-item">
                        <span class="card-detail-label">Appointment Date</span>
                        <span class="card-detail-value">📅 ${item.appointment_date || '-'}</span>
                    </div>

                    <div class="card-detail-item">
                        <span class="card-detail-label">Appointment Time</span>
                        <span class="card-detail-value">⏰ ${formatTime12Hour(item.appointment_time)}</span>
                    </div>

                    <div class="card-detail-item">
                        <span class="card-detail-label">Age / Gender</span>
                        <span class="card-detail-value">${item.age || '-'} Yrs (${escapeHtml(genderDisplay)})</span>
                    </div>

                    <div class="card-detail-item">
                        <span class="card-detail-label">Issue / Problem</span>
                        <span class="card-detail-value">${escapeHtml(issueDisplay)}</span>
                    </div>

                    ${docHtml}
                </div>

                ${actionHtml}
            `;

            cardsList.appendChild(card);
        });

        // Helper: Fetch available slots for Reschedule Date
        async function loadRescheduleSlots(doctorId, selectedDate, selectElem, currentAppId) {
            if (!selectElem) return;
            if (!selectedDate) {
                selectElem.innerHTML = generateSlotOptionsHtml();
                return;
            }

            try {
                let query = supabaseClient
                    .from("appointments")
                    .select("id, appointment_time, status, doctor_id")
                    .eq("appointment_date", selectedDate);

                if (doctorId && doctorId !== "undefined" && doctorId !== "null" && String(doctorId).trim() !== "") {
                    query = query.eq("doctor_id", doctorId);
                }

                let { data, error } = await query;

                // Fallback query if error occurred
                if (error) {
                    console.warn("Primary slots query error, trying fallback query:", error);
                    const fallbackRes = await supabaseClient
                        .from("appointments")
                        .select("id, appointment_time, status")
                        .eq("appointment_date", selectedDate);
                    data = fallbackRes.data || [];
                }

                const bookedTimes = new Set(
                    (data || [])
                        .filter(app => app.status !== "Cancelled" && String(app.id) !== String(currentAppId) && app.appointment_time)
                        .map(app => normalizeTime(app.appointment_time))
                );

                selectElem.innerHTML = generateSlotOptionsHtml(bookedTimes);

            } catch (err) {
                console.error("Reschedule slots exception:", err);
                selectElem.innerHTML = generateSlotOptionsHtml();
            }
        }

        // 1. Toggle Cancel Confirmation Box
        document.querySelectorAll(".btn-cancel-trigger").forEach(btn => {
            btn.addEventListener("click", function () {
                const targetId = this.getAttribute("data-target");
                const confirmBox = document.getElementById(targetId);
                if (confirmBox) {
                    confirmBox.classList.toggle("active");
                }
            });
        });

        // 2. Toggle Reschedule Box & Load Initial Slots
        document.querySelectorAll(".btn-res-trigger").forEach(btn => {
            btn.addEventListener("click", function () {
                const targetId = this.getAttribute("data-target");
                const docId = this.getAttribute("data-doctor");
                const appId = this.getAttribute("data-id");
                const resDateElem = document.getElementById(this.getAttribute("data-date-id"));
                const resTimeElem = document.getElementById(this.getAttribute("data-time-id"));
                const resBox = document.getElementById(targetId);

                if (resBox) {
                    resBox.classList.toggle("active");
                    if (resBox.classList.contains("active") && resDateElem && resTimeElem) {
                        loadRescheduleSlots(docId, resDateElem.value, resTimeElem, appId);
                    }
                }
            });
        });

        // 3. Listen to Reschedule Date Changes
        list.forEach(item => {
            const resDateElem = document.getElementById(`resDate-${item.id}`);
            const resTimeElem = document.getElementById(`resTime-${item.id}`);
            if (resDateElem && resTimeElem) {
                resDateElem.addEventListener("change", function () {
                    loadRescheduleSlots(item.doctor_id, this.value, resTimeElem, item.id);
                });
            }
        });

        // 4. Hide Dialog Box on 'Cancel / No'
        document.querySelectorAll(".btn-confirm-no").forEach(btn => {
            btn.addEventListener("click", function () {
                const targetId = this.getAttribute("data-target");
                const confirmBox = document.getElementById(targetId);
                if (confirmBox) {
                    confirmBox.classList.remove("active");
                }
            });
        });

        // 5. Execute Reschedule Update on 'Confirm Reschedule'
        document.querySelectorAll(".btn-confirm-reschedule").forEach(btn => {
            btn.addEventListener("click", async function () {
                const id = this.getAttribute("data-id");
                const mobile = this.getAttribute("data-mobile");
                const dateElem = document.getElementById(this.getAttribute("data-date-id"));
                const timeElem = document.getElementById(this.getAttribute("data-time-id"));
                const boxId = this.getAttribute("data-box-id");

                const newDate = dateElem ? dateElem.value : null;
                const newTime = timeElem ? timeElem.value : null;

                if (!newDate) {
                    if (typeof showToast === "function") showToast("Please select a new date.", "error");
                    return;
                }
                if (!newTime) {
                    if (typeof showToast === "function") showToast("Please select a new time slot.", "error");
                    return;
                }

                this.disabled = true;
                this.classList.add("loading");

                try {
                    const parsedId = isNaN(Number(id)) ? id : Number(id);
                    const { data, error } = await supabaseClient
                        .from("appointments")
                        .update({
                            appointment_date: newDate,
                            appointment_time: newTime,
                            status: "Pending"
                        })
                        .eq("id", parsedId)
                        .select();

                    if (error) {
                        console.error("Reschedule Error:", error);
                        if (typeof showToast === "function") showToast("Failed to reschedule: " + error.message, "error");
                        this.disabled = false;
                        this.classList.remove("loading");
                        return;
                    }

                    if (typeof showToast === "function") {
                        showToast("Appointment rescheduled successfully!", "success");
                    }

                    const boxElem = document.getElementById(boxId);
                    if (boxElem) boxElem.classList.remove("active");

                    // Refresh lookup results
                    lookupForm.dispatchEvent(new Event("submit"));

                } catch (err) {
                    console.error("Reschedule Exception:", err);
                    if (typeof showToast === "function") showToast("An error occurred while rescheduling.", "error");
                    this.disabled = false;
                    this.classList.remove("loading");
                }
            });
        });

        // 6. Execute Cancel Update on 'Yes, Cancel Booking'
        document.querySelectorAll(".btn-confirm-yes").forEach(btn => {
            btn.addEventListener("click", async function () {
                const id = this.getAttribute("data-id");
                const mobile = this.getAttribute("data-mobile");
                const date = this.getAttribute("data-date");
                const time = this.getAttribute("data-time");

                this.disabled = true;
                this.textContent = "⏳ Cancelling...";

                try {
                    let updateErr = null;
                    let updateData = null;

                    if (id && id !== "undefined" && id !== "null") {
                        const parsedId = isNaN(Number(id)) ? id : Number(id);
                        const res = await supabaseClient
                            .from("appointments")
                            .update({ status: "Cancelled" })
                            .eq("id", parsedId)
                            .select();
                        updateErr = res.error;
                        updateData = res.data;
                    }

                    if (!updateData || updateData.length === 0) {
                        const res2 = await supabaseClient
                            .from("appointments")
                            .update({ status: "Cancelled" })
                            .eq("mobile", mobile)
                            .eq("appointment_date", date)
                            .eq("appointment_time", time)
                            .select();
                        updateErr = res2.error || updateErr;
                        updateData = res2.data;
                    }

                    if (updateErr) {
                        console.error("Cancellation Error:", updateErr);
                        let errMsg = updateErr.message || "Unknown error";
                        if (typeof showToast === "function") showToast("Could not cancel appointment: " + errMsg, "error");
                        this.disabled = false;
                        this.textContent = "Yes, Cancel Booking";
                        return;
                    }

                    if (typeof showToast === "function") {
                        showToast("Appointment cancelled successfully.", "info");
                    }

                    // Refresh lookup results
                    lookupForm.dispatchEvent(new Event("submit"));

                } catch (err) {
                    console.error("Cancel Exception:", err);
                    if (typeof showToast === "function") showToast("An error occurred while cancelling.", "error");
                    this.disabled = false;
                    this.textContent = "Yes, Cancel Booking";
                }
            });
        });

        // Setup Realtime Listener for looked-up mobile number
        setupRealtimePatientAppointments(mobileNumber);
    }

    // 4. Supabase Realtime Subscriptions for Patient Portal
    let patientRealtimeChannel = null;

    function setupRealtimePatientAppointments(mobileNumber) {
        if (!supabaseClient || !mobileNumber) return;

        // Unsubscribe previous channel if existing
        if (patientRealtimeChannel) {
            supabaseClient.removeChannel(patientRealtimeChannel);
            patientRealtimeChannel = null;
        }

        patientRealtimeChannel = supabaseClient
            .channel(`patient-realtime-${mobileNumber}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `mobile=eq.${mobileNumber}` }, (payload) => {
                console.log("Real-time patient appointment update:", payload);
                if (typeof showToast === "function") {
                    showToast("Appointment status updated in real-time!", "info");
                }
                // Trigger form lookup submit to automatically refresh view
                if (lookupForm) {
                    lookupForm.dispatchEvent(new Event("submit"));
                }
            })
            .subscribe();
    }

    // Listen for doctor updates in real-time (if doctor email or name changes, update doctorsMap)
    if (supabaseClient) {
        supabaseClient
            .channel('patient-doctors-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, async () => {
                await loadDoctorsMap();
                const activeMobile = mobileInput ? mobileInput.value.trim() : "";
                if (activeMobile && lookupForm) {
                    lookupForm.dispatchEvent(new Event("submit"));
                }
            })
            .subscribe();
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
