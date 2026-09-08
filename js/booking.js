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

    const selectDoctorDateNotice = document.getElementById("selectDoctorDateNotice");
    const timeSlotsWrapper = document.getElementById("timeSlotsWrapper");

    // 3c. Fetch & Disable Already Booked Time Slots for Selected Doctor & Date
    async function fetchAndHideBookedSlots() {
        const selectedDate = dateInput ? dateInput.value : null;
        const selectedDoctorId = doctorSelect ? doctorSelect.value : null;

        // Reset any previously selected slot when doctor or date changes
        slotButtons.forEach(btn => btn.classList.remove("selected"));
        if (hiddenTimeInput) hiddenTimeInput.value = "";
        if (selectedSlotInfo) selectedSlotInfo.innerHTML = "";

        // Require BOTH Doctor and Date to be selected
        if (!selectedDate || !selectedDoctorId || !supabaseClient) {
            if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "block";
            if (timeSlotsWrapper) timeSlotsWrapper.style.display = "none";
            updateSlotNotice(0, slotButtons.length);
            return;
        }

        // Show slot selector grid
        if (selectDoctorDateNotice) selectDoctorDateNotice.style.display = "none";
        if (timeSlotsWrapper) timeSlotsWrapper.style.display = "flex";

        try {
            let query = supabaseClient
                .from("appointments")
                .select("appointment_time, status, doctor_id")
                .eq("appointment_date", selectedDate)
                .eq("doctor_id", selectedDoctorId);

            const { data, error } = await query;

            if (error) {
                console.warn("Could not check booked slots for date & doctor:", error);
                return;
            }

            const bookedTimes = new Set(
                (data || [])
                    .filter(app => app.status !== "Cancelled" && app.appointment_time)
                    .map(app => normalizeTime(app.appointment_time))
            );

            let bookedCount = 0;
            slotButtons.forEach(btn => {
                const rawTime = btn.getAttribute("data-time");
                const normTime = normalizeTime(rawTime);
                
                if (bookedTimes.has(normTime) || bookedTimes.has(rawTime)) {
                    btn.classList.add("is-booked-disabled");
                    btn.disabled = true;
                    bookedCount++;
                } else {
                    btn.classList.remove("is-booked-disabled");
                    btn.disabled = false;
                }
            });

            updateSlotNotice(bookedCount, slotButtons.length);

        } catch (err) {
            console.error("Error fetching booked slots:", err);
        }
    }

    function updateSlotNotice(bookedCount, totalSlots) {
        let noticeElem = document.getElementById("bookedSlotsNotice");
        if (!noticeElem) {
            const wrapper = document.querySelector(".time-slots-wrapper");
            if (wrapper) {
                noticeElem = document.createElement("div");
                noticeElem.id = "bookedSlotsNotice";
                noticeElem.className = "booked-slots-notice";
                wrapper.parentNode.appendChild(noticeElem);
            }
        }

        if (!noticeElem) return;

        if (bookedCount >= totalSlots && totalSlots > 0) {
            noticeElem.innerHTML = `<span style="color:#e11d48; font-weight:600;">⚠️ All slots are fully booked for this doctor on ${dateInput.value}. Please choose another date or doctor.</span>`;
            if (typeof showToast === "function") {
                showToast("All slots are fully booked for this doctor on this date.", "warning");
            }
        } else if (bookedCount > 0) {
            noticeElem.innerHTML = `<span style="color:var(--text-muted); font-size:0.85rem;">🔒 <strong>${bookedCount}</strong> slot(s) are already booked for this doctor on this date.</span>`;
        } else {
            noticeElem.innerHTML = "";
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
    function setLoading(isLoading, customText) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.classList.add("loading");
            submitBtnText.textContent = customText || "Processing Booking...";
        } else {
            submitBtn.disabled = false;
            submitBtn.classList.remove("loading");
            submitBtnText.textContent = "Pay & Book Appointment";
        }
    }

    // 4. Form Submit Handler (Razorpay Test Mode Payment + Appointment Booking)
    bookingForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        hideError();

        // Check Supabase config
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

        // Validate Razorpay Config
        if (!isRazorpayConfigured()) {
            showError(
                "Razorpay Test Key missing!\n\n" +
                "👉 FIX: Please open 'js/config.js' and paste your RAZORPAY_KEY_ID (e.g. 'rzp_test_xxxxxxxxxxxxxx').\n" +
                "You can get your free Test Key from Razorpay Dashboard -> Settings -> API Keys."
            );
            return;
        }

        if (typeof window.Razorpay === "undefined") {
            showError("Razorpay SDK script failed to load. Please check your internet connection and refresh the page.");
            return;
        }

        // STEP 1: Launch Razorpay Checkout Popup (Amount: Rs. 100 = 10000 paise)
        setLoading(true, "Opening Payment Gateway...");

        const options = {
            key: RAZORPAY_KEY_ID,
            amount: 10000, // Rs. 100 in paise
            currency: "INR",
            name: "SmileCare Dental Clinic",
            description: "Dental Consultation Fee (Rs. 100)",
            prefill: {
                name: patient_name,
                email: email || "",
                contact: mobile
            },
            theme: {
                color: "#0d9488" // Brand Teal
            },
            handler: async function (response) {
                // Payment Successful!
                const payment_id = response.razorpay_payment_id || `pay_test_${Date.now()}`;
                setLoading(true, "Payment Successful! Saving Booking...");

                await processAppointmentSave({
                    doctor_id,
                    patient_name,
                    age,
                    gender,
                    email,
                    mobile,
                    issue,
                    appointment_date,
                    appointment_time,
                    file,
                    payment_id
                });
            },
            modal: {
                ondismiss: function () {
                    setLoading(false);
                    showError("Payment failed or cancelled, please try again.");
                }
            }
        };

        try {
            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function (resp) {
                console.error("Razorpay Payment Failed:", resp.error);
                setLoading(false);
                const reason = (resp.error && (resp.error.description || resp.error.reason)) ? resp.error.description || resp.error.reason : "";
                showError(`Payment failed, please try again.${reason ? " (" + reason + ")" : ""}`);
            });
            rzp.open();
        } catch (rzpErr) {
            console.error("Razorpay Popup Error:", rzpErr);
            setLoading(false);
            showError("Failed to open Razorpay payment popup. Please check your Razorpay Key ID in config.js.");
        }
    });

    // Helper: Save Appointment to Supabase after Payment Success
    async function processAppointmentSave(data) {
        const { doctor_id, patient_name, age, gender, email, mobile, issue, appointment_date, appointment_time, file, payment_id } = data;

        try {
            let document_url = null;
            let uploadWarning = false;

            // Upload Document if attached
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

                    if (!uploadError) {
                        const { data: publicUrlData } = supabaseClient
                            .storage
                            .from("patient-documents")
                            .getPublicUrl(filePath);

                        if (publicUrlData && publicUrlData.publicUrl) {
                            document_url = publicUrlData.publicUrl;
                        }
                    } else {
                        uploadWarning = true;
                    }
                } catch (storageException) {
                    uploadWarning = true;
                }
            }

            // Insert into 'appointments' table
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
                payment_id: payment_id || null,
                status: "Pending"
            };

            let { data: insertData, error: dbError } = await supabaseClient
                .from("appointments")
                .insert([payload])
                .select();

            // Retry fallback if payment_id column is missing in database schema
            if (dbError && (dbError.message.includes("payment_id") || dbError.message.includes("schema cache"))) {
                console.warn("payment_id column missing in Supabase table schema. Retrying with payment_id in issue text...");
                delete payload.payment_id;
                payload.issue = `${issue} [Payment ID: ${payment_id}]`;

                const retryRes = await supabaseClient
                    .from("appointments")
                    .insert([payload])
                    .select();

                dbError = retryRes.error;
                insertData = retryRes.data;
            }

            // Retry fallback if gender column is missing
            if (dbError && (dbError.message.includes("gender") || dbError.message.includes("schema cache"))) {
                delete payload.gender;
                payload.issue = `${payload.issue} [Gender: ${gender}]`;

                const retryRes = await supabaseClient
                    .from("appointments")
                    .insert([payload])
                    .select();

                dbError = retryRes.error;
                insertData = retryRes.data;
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

            // Show Success Confirmation View
            if (typeof showToast === "function") {
                showToast("Payment Successful! Appointment booked.", "success");
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

            const summaryPaymentElem = document.getElementById("summaryPayment");
            if (summaryPaymentElem) {
                summaryPaymentElem.innerHTML = `Payment Successful! Amount Paid: Rs. 100 ✅`;
            }
            const summaryPaymentIdElem = document.getElementById("summaryPaymentId");
            if (summaryPaymentIdElem) {
                summaryPaymentIdElem.textContent = payment_id || "N/A";
            }

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
                payment_id: payment_id,
                payment_status: "Paid (Rs. 100)",
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
            console.error("Booking save failed:", err);
            showError("Payment was successful, but saving appointment failed: " + (err.message || "Unknown Error"));
        } finally {
            setLoading(false);
        }
    }

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

