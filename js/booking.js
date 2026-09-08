// ==========================================
// PATIENT BOOKING PAGE LOGIC (booking.js)
// ==========================================

document.addEventListener("DOMContentLoaded", function () {
    const configAlert = document.getElementById("configAlert");
    const bookingForm = document.getElementById("bookingForm");
    const confirmationCard = document.getElementById("confirmationCard");
    const formAlert = document.getElementById("formAlert");
    const submitBtn = document.getElementById("submitBtn");
    const submitBtnText = document.getElementById("submitBtnText");
    const documentFileInput = document.getElementById("documentFile");
    const fileNamePreview = document.getElementById("fileNamePreview");
    const dateInput = document.getElementById("appointmentDate");
    const bookAnotherBtn = document.getElementById("bookAnotherBtn");

    const doctorSelect = document.getElementById("doctorSelect");

    // 1b. Fetch & Populate Doctors Dropdown from Supabase
    async function loadDoctorsList() {
        if (!doctorSelect) return;
        if (!isSupabaseConfigured() || !supabaseClient) {
            doctorSelect.innerHTML = `<option value="" disabled selected>Supabase setup required</option>`;
            return;
        }

        try {
            const { data: doctors, error } = await supabaseClient
                .from("doctors")
                .select("*")
                .order("name", { ascending: true });

            if (error) {
                console.warn("Could not fetch doctors list:", error);
                doctorSelect.innerHTML = `<option value="" disabled selected>Select Doctor</option>`;
                return;
            }

            if (!doctors || doctors.length === 0) {
                doctorSelect.innerHTML = `<option value="" disabled selected>No doctors available</option>`;
                return;
            }

            let html = `<option value="" disabled selected>Select Doctor</option>`;
            doctors.forEach(doc => {
                let cleanName = String(doc.name || "").trim();
                if (!/^dr\.?\s+/i.test(cleanName)) {
                    cleanName = "Dr. " + cleanName;
                }
                const specText = doc.specialization ? ` - ${doc.specialization}` : "";
                html += `<option value="${doc.id}">${cleanName}${specText}</option>`;
            });
            doctorSelect.innerHTML = html;

        } catch (err) {
            console.error("Load doctors exception:", err);
            doctorSelect.innerHTML = `<option value="" disabled selected>Select Doctor</option>`;
        }
    }

    loadDoctorsList();

    // 2. Prevent past dates in Appointment Date picker
    const today = new Date().toISOString().split("T")[0];
    dateInput.setAttribute("min", today);

    // 3. Show selected filename preview
    if (documentFileInput) {
        documentFileInput.addEventListener("change", function () {
            if (this.files && this.files[0]) {
                const file = this.files[0];
                const fileNamePreview = document.getElementById("fileNamePreview");
                if (fileNamePreview) {
                    fileNamePreview.textContent = `📁 Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                }
            }
        });
    }

    // 3b. Interactive Time Slot Picker Logic
    const slotButtons = document.querySelectorAll(".time-slot-btn");
    const hiddenTimeInput = document.getElementById("appointmentTime");
    const selectedSlotInfo = document.getElementById("selectedSlotInfo");

    slotButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            if (this.classList.contains("is-booked-hidden")) return;
            slotButtons.forEach(b => b.classList.remove("selected"));
            this.classList.add("selected");
            const chosenTime = this.getAttribute("data-time");
            hiddenTimeInput.value = chosenTime;
            if (selectedSlotInfo) {
                selectedSlotInfo.innerHTML = `<span class="slot-badge-selected">✓ Selected Time Slot: <strong>${chosenTime}</strong></span>`;
            }
            hideError();
        });
    });

    function resetTimeSlots() {
        slotButtons.forEach(b => {
            b.classList.remove("selected");
            b.classList.remove("is-booked-hidden");
        });
        if (hiddenTimeInput) hiddenTimeInput.value = "";
        if (selectedSlotInfo) selectedSlotInfo.innerHTML = "";
        const noticeElem = document.getElementById("bookedSlotsNotice");
        if (noticeElem) noticeElem.innerHTML = "";
    }

    // Helper: Normalize time formats (e.g. "11:00:00" -> "11:00 AM", "14:30:00" -> "02:30 PM", "11:00 AM" -> "11:00 AM")
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

    // Helper: Convert time string to minutes from midnight (e.g. "10:30 AM" -> 630, "18:00:00" -> 1080)
    function parseTimeToMinutes(t) {
        if (!t) return 0;
        t = String(t).trim().toUpperCase();
        const match = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
        if (!match) return 0;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const period = match[3];

        if (period === "PM" && h < 12) h += 12;
        if (period === "AM" && h === 12) h = 0;

        return h * 60 + m;
    }

    function setAvailabilityNotice(htmlMsg, type = "error") {
        let noticeElem = document.getElementById("bookedSlotsNotice");
        if (!noticeElem) {
            const wrapper = document.querySelector(".time-slots-wrapper");
            if (wrapper && wrapper.parentNode) {
                noticeElem = document.createElement("div");
                noticeElem.id = "bookedSlotsNotice";
                noticeElem.className = "booked-slots-notice";
                wrapper.parentNode.appendChild(noticeElem);
            }
        }
        if (noticeElem) {
            if (htmlMsg) {
                noticeElem.innerHTML = `<div style="padding: 12px 16px; background: ${type === 'error' ? '#fff1f2' : '#f8fafc'}; border: 1.5px solid ${type === 'error' ? '#fecdd3' : '#cbd5e1'}; border-radius: 8px; color: ${type === 'error' ? '#be123c' : '#475569'}; font-size: 0.92rem; font-weight: 500;">${htmlMsg}</div>`;
            } else {
                noticeElem.innerHTML = "";
            }
        }
    }

    const selectDoctorDateNotice = document.getElementById("selectDoctorDateNotice");
    const timeSlotsWrapper = document.getElementById("timeSlotsWrapper");

    // 3c. Fetch Availability, Leaves & Disable Booked Slots for Selected Doctor & Date
    async function fetchAndHideBookedSlots() {
        const selectedDate = dateInput ? dateInput.value : null;
        const selectedDoctorId = doctorSelect ? doctorSelect.value : null;

        // Reset inputs and slot states
        if (dateInput) {
            dateInput.style.borderColor = "";
            dateInput.style.backgroundColor = "";
        }
        slotButtons.forEach(btn => btn.classList.remove("selected"));
        if (hiddenTimeInput) hiddenTimeInput.value = "";
        if (selectedSlotInfo) selectedSlotInfo.innerHTML = "";

        // Require BOTH Doctor and Date to be selected
        if (!selectedDate || !selectedDoctorId || !supabaseClient) {
            if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "block";
            if (timeSlotsWrapper) timeSlotsWrapper.style.display = "none";
            setAvailabilityNotice("", "info");
            return;
        }

        const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
        const docName = selectedOption ? selectedOption.text.split("-")[0].trim() : "Doctor";

        try {
            // STEP 1: Check doctor_leaves table
            const { data: leaves, error: leavesErr } = await supabaseClient
                .from("doctor_leaves")
                .select("*")
                .eq("doctor_id", selectedDoctorId)
                .eq("leave_date", selectedDate);

            if (!leavesErr && leaves && leaves.length > 0) {
                if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "none";
                if (timeSlotsWrapper) timeSlotsWrapper.style.display = "none";
                if (dateInput) {
                    dateInput.style.borderColor = "#e11d48";
                    dateInput.style.backgroundColor = "#fff1f2";
                }
                const reasonText = leaves[0].reason ? ` (Reason: ${leaves[0].reason})` : "";
                setAvailabilityNotice(`⚠️ <strong>${escapeHtml(docName)}</strong> is on leave on this date${reasonText}. Please select another date.`, "error");
                return;
            }

            // STEP 2: Check doctor_availability table for day_of_week
            const dateObj = new Date(selectedDate + "T00:00:00");
            const daysArr = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const dayName = daysArr[dateObj.getDay()];

            const { data: avail, error: availErr } = await supabaseClient
                .from("doctor_availability")
                .select("*")
                .eq("doctor_id", selectedDoctorId)
                .eq("day_of_week", dayName);

            let startTimeMin = 600;  // Default 10:00 AM (600 mins)
            let endTimeMin = 1080;   // Default 06:00 PM (1080 mins)
            let isAvailableDay = true;

            if (!availErr && avail && avail.length > 0) {
                const a = avail[0];
                if (a.is_available === false) {
                    isAvailableDay = false;
                } else {
                    if (a.start_time) startTimeMin = parseTimeToMinutes(a.start_time);
                    if (a.end_time) endTimeMin = parseTimeToMinutes(a.end_time);
                }
            }

            if (!isAvailableDay) {
                if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "none";
                if (timeSlotsWrapper) timeSlotsWrapper.style.display = "none";
                if (dateInput) {
                    dateInput.style.borderColor = "#e11d48";
                    dateInput.style.backgroundColor = "#fff1f2";
                }
                setAvailabilityNotice(`⚠️ <strong>${escapeHtml(docName)}</strong> is not available on <strong>${dayName}s</strong>. Please select another date.`, "error");
                return;
            }

            // STEP 3: Doctor is available! Clear notice and show slot grid
            setAvailabilityNotice("", "info");
            if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "none";
            if (timeSlotsWrapper) timeSlotsWrapper.style.display = "flex";

            // STEP 4: Fetch booked appointments
            let query = supabaseClient
                .from("appointments")
                .select("appointment_time, status, doctor_id")
                .eq("appointment_date", selectedDate)
                .eq("doctor_id", selectedDoctorId);

            const { data, error } = await query;

            if (error) {
                console.warn("Could not check booked slots:", error);
            }

            const bookedTimes = new Set(
                (data || [])
                    .filter(app => app.status !== "Cancelled" && app.appointment_time)
                    .map(app => normalizeTime(app.appointment_time))
            );

            let bookedCount = 0;
            let visibleCount = 0;

            slotButtons.forEach(btn => {
                const rawTime = btn.getAttribute("data-time");
                const normTime = normalizeTime(rawTime);
                const slotMin = parseTimeToMinutes(rawTime);

                // Slot is visible only within [startTimeMin, endTimeMin]
                if (slotMin >= startTimeMin && slotMin <= endTimeMin) {
                    btn.style.display = "";
                    visibleCount++;

                    if (bookedTimes.has(normTime) || bookedTimes.has(rawTime)) {
                        btn.classList.add("is-booked-disabled");
                        btn.disabled = true;
                        bookedCount++;
                    } else {
                        btn.classList.remove("is-booked-disabled");
                        btn.disabled = false;
                    }
                } else {
                    btn.style.display = "none";
                }
            });

            // Hide slot groups if all buttons inside are hidden
            document.querySelectorAll(".slot-group").forEach(group => {
                const hasVisibleBtns = Array.from(group.querySelectorAll(".time-slot-btn")).some(b => b.style.display !== "none");
                group.style.display = hasVisibleBtns ? "block" : "none";
            });

            updateSlotNotice(bookedCount, visibleCount);

        } catch (err) {
            console.error("Error checking availability & booked slots:", err);
        }
    }

    function updateSlotNotice(bookedCount, visibleSlots) {
        if (bookedCount >= visibleSlots && visibleSlots > 0) {
            setAvailabilityNotice(`⚠️ All available slots are fully booked for this doctor on ${dateInput.value}. Please choose another date or doctor.`, "error");
            if (typeof showToast === "function") {
                showToast("All slots are fully booked for this doctor on this date.", "warning");
            }
        } else if (bookedCount > 0) {
            setAvailabilityNotice(`🔒 <strong>${bookedCount}</strong> slot(s) are already booked for this doctor on this date.`, "info");
        }
    }

    dateInput.addEventListener("change", fetchAndHideBookedSlots);
    dateInput.addEventListener("input", fetchAndHideBookedSlots);
    if (doctorSelect) {
        doctorSelect.addEventListener("change", fetchAndHideBookedSlots);
    }

    // Initial check if date input has pre-filled value
    if (dateInput.value) {
        fetchAndHideBookedSlots();
    }

    // Helper: Show Error Alert with Toast
    function showError(message) {
        formAlert.style.whiteSpace = "pre-wrap";
        formAlert.textContent = message;
        formAlert.classList.add("active");
        formAlert.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (typeof showToast === "function") {
            showToast(message.split("\n")[0], "error");
        }
    }

    // Helper: Hide Error Alert
    function hideError() {
        formAlert.textContent = "";
        formAlert.classList.remove("active");
    }

    // Helper: Set Loading State
    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.classList.add("loading");
            submitBtnText.textContent = "Processing Booking...";
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove("loading");
            submitBtnText.textContent = "Book Appointment";
        }
    }

    // 4. Form Submit Handler
    bookingForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        hideError();

        // Check config
        if (!isSupabaseConfigured() || !supabaseClient) {
            showError("Supabase credentials missing! Please configure config.js with your SUPABASE_URL and SUPABASE_ANON_KEY.");
            return;
        }

        // Get Form Input Values
        const doctor_id = doctorSelect ? doctorSelect.value : null;
        const patient_name = document.getElementById("patientName").value.trim();
        const ageVal = document.getElementById("age").value.trim();
        const genderElem = document.getElementById("gender");
        const gender = genderElem ? genderElem.value : null;
        const email = document.getElementById("email").value.trim() || null;
        const mobile = document.getElementById("mobile").value.trim();
        const issue = document.getElementById("issue").value.trim();
        const appointment_date = document.getElementById("appointmentDate").value;
        const appointment_time = document.getElementById("appointmentTime").value;
        const file = (documentFileInput && documentFileInput.files) ? (documentFileInput.files[0] || null) : null;

        // Validation Checks
        if (!doctor_id) {
            showError("Please select a Doctor.");
            return;
        }

        if (!patient_name) {
            showError("Please enter the Patient Name.");
            return;
        }

        const age = parseInt(ageVal, 10);
        if (isNaN(age) || age <= 0) {
            showError("Please enter a valid Age.");
            return;
        }

        if (!gender) {
            showError("Please select your Gender.");
            return;
        }

        // 10-digit mobile number validation
        const mobileRegex = /^\d{10}$/;
        if (!mobileRegex.test(mobile)) {
            showError("Please enter a valid 10-digit Mobile Number (e.g. 9876543210).");
            return;
        }

        if (!issue) {
            showError("Please describe your Dental Issue/Problem.");
            return;
        }

        if (!appointment_date) {
            showError("Please select an Appointment Date.");
            return;
        }

        if (appointment_date < today) {
            showError("Past dates cannot be selected. Please select a future date.");
            return;
        }

        if (!appointment_time) {
            showError("Please select an Appointment Time.");
            return;
        }

        // Start Submit Process
        setLoading(true);

        try {
            let document_url = null;
            let uploadWarning = false;

            // STEP 1: Upload Document to Supabase Storage Bucket if provided (Non-blocking fallback)
            if (file) {
                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                    const fileExt = (file.name.split('.').pop() || "").toLowerCase();
                    const filePath = `${Date.now()}_${cleanFileName}`;

                    let detectedMime = file.type;
                    if (!detectedMime || detectedMime === "application/octet-stream") {
                        if (fileExt === "pdf") detectedMime = "application/pdf";
                        else if (fileExt === "png") detectedMime = "image/png";
                        else if (fileExt === "jpg" || fileExt === "jpeg") detectedMime = "image/jpeg";
                    }

                    const { data: storageData, error: uploadError } = await supabaseClient
                        .storage
                        .from("patient-documents")
                        .upload(filePath, file, {
                            cacheControl: "3600",
                            contentType: detectedMime || "application/pdf",
                            upsert: false
                        });

                    if (uploadError) {
                        console.warn("Storage Upload Warning (Proceeding with booking without document):", uploadError);
                        uploadWarning = true;
                        document_url = null;
                    } else {
                        // Get Public URL of uploaded document
                        const { data: publicUrlData } = supabaseClient
                            .storage
                            .from("patient-documents")
                            .getPublicUrl(filePath);

                        if (publicUrlData && publicUrlData.publicUrl) {
                            document_url = publicUrlData.publicUrl;
                        }
                    }
                } catch (storageException) {
                    console.warn("Storage Exception (Proceeding without document):", storageException);
                    uploadWarning = true;
                    document_url = null;
                }
            }

            // STEP 2: Insert record into 'appointments' table
            let payload = {
                patient_name,
                age,
                gender,
                email,
                mobile,
                issue,
                document_url,
                appointment_date,
                appointment_time,
                doctor_id,
                status: "Pending"
            };

            let { data: insertData, error: dbError } = await supabaseClient
                .from("appointments")
                .insert([payload])
                .select();

            // If gender or doctor_id column issue occurs, retry
            if (dbError && (dbError.message.includes("gender") || dbError.message.includes("schema cache"))) {
                console.warn("Gender column missing in Supabase table schema. Retrying with gender appended to issue...");
                delete payload.gender;
                payload.issue = `${issue} [Gender: ${gender}]`;
                
                const retryRes = await supabaseClient
                    .from("appointments")
                    .insert([payload])
                    .select();
                
                dbError = retryRes.error;
            }

            if (dbError) {
                console.error("Database Insert Error:", dbError);
                let dbErrStr = dbError.message || "Database insert error.";
                if (dbErrStr.toLowerCase().includes("row-level security") || dbErrStr.toLowerCase().includes("policy")) {
                    throw new Error(
                        "Appointments table insert blocked (Supabase Table RLS Policy Blocked).\n\n" +
                        "👉 SUPABASE FIX: Go to Supabase Dashboard -> SQL Editor and run:\n" +
                        "CREATE POLICY \"Allow public insert\" ON appointments FOR INSERT TO public WITH CHECK (true);"
                    );
                }
                throw new Error(dbErrStr);
            }

            // STEP 3: Show Success Confirmation View
            if (typeof showToast === "function") {
                showToast("Appointment booked successfully!", "success");
            }
            const createdApp = (insertData && insertData[0]) ? insertData[0] : {};
            const displayId = (typeof formatBookingId === "function") ? formatBookingId(createdApp.id) : (createdApp.id || 'N/A');
            const summaryBookingIdElem = document.getElementById("summaryBookingId");
            if (summaryBookingIdElem) summaryBookingIdElem.textContent = displayId;

            document.getElementById("summaryName").textContent = patient_name;
            const summaryDocElem = document.getElementById("summaryDoctor");
            let doctorNameText = "SmileCare Specialist";
            if (summaryDocElem && doctorSelect && doctorSelect.selectedIndex >= 0) {
                doctorNameText = doctorSelect.options[doctorSelect.selectedIndex].text;
                summaryDocElem.textContent = doctorNameText;
            }
            const formattedTime = (typeof formatTime12Hour === "function") ? formatTime12Hour(appointment_time) : appointment_time;
            document.getElementById("summaryDate").textContent = appointment_date;
            document.getElementById("summaryTime").textContent = formattedTime;

            if (uploadWarning) {
                document.getElementById("summaryStatus").innerHTML = "Pending <br><small style='color:var(--text-muted);'>(Document upload failed, but appointment was booked successfully)</small>";
            } else {
                document.getElementById("summaryStatus").textContent = "Pending";
            }

            window.lastBookedAppointment = {
                id: createdApp.id || 'N/A',
                patient_name: patient_name,
                age: age,
                gender: gender,
                mobile: mobile,
                doctor_name: doctorNameText,
                appointment_date: appointment_date,
                appointment_time: formattedTime,
                issue: issue,
                status: "Pending"
            };

            window.triggerBookingPdfDownload = function () {
                if (window.lastBookedAppointment && typeof generateAppointmentPDF === "function") {
                    generateAppointmentPDF(window.lastBookedAppointment);
                }
            };

            bookingForm.reset();
            resetTimeSlots();
            if (fileNamePreview) fileNamePreview.textContent = "";
            bookingForm.style.display = "none";
            confirmationCard.classList.add("active");

        } catch (err) {
            console.error("Booking failed:", err);
            showError("Something went wrong, please try again.\n" + (err.message || "Unknown Error"));
        } finally {
            setLoading(false);
        }
    });

    // 5. "Book Another Appointment" Button Click Handler
    bookAnotherBtn.addEventListener("click", function () {
        confirmationCard.classList.remove("active");
        bookingForm.style.display = "block";
        resetTimeSlots();
        if (fileNamePreview) fileNamePreview.textContent = "";
        hideError();
    });

    // 6. Supabase Realtime Subscriptions for Booking Page
    function setupRealtimeBooking() {
        if (!supabaseClient) return;

        // Listen for doctor updates (e.g., name, email, specialization, or new doctors added)
        supabaseClient
            .channel('booking-doctors-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doctors' }, () => {
                console.log("Real-time doctor list updated");
                loadDoctorsList();
            })
            .subscribe();

        // Listen for appointment changes (e.g. slot booked by another user in real-time)
        supabaseClient
            .channel('booking-appointments-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
                console.log("Real-time appointment change detected, refreshing slot availability...");
                if (dateInput && dateInput.value && doctorSelect && doctorSelect.value) {
                    fetchAndHideBookedSlots();
                }
            })
            .subscribe();
    }

    setupRealtimeBooking();
});

