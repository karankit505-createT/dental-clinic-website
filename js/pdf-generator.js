// ====================================================================
// SMILECARE DENTAL CLINIC - OFFICIAL APPOINTMENT SLIP PDF GENERATOR
// ====================================================================
// Library: jsPDF UMD (loaded via CDN)
// Client-side 1-click PDF generation matching exact design specification
// ====================================================================

window.generateAppointmentPDF = function (data) {
    if (!data) data = {};

    if (!window.jspdf || !window.jspdf.jsPDF) {
        if (typeof showToast === "function") {
            showToast("PDF generation library is loading. Please try again in a moment.", "error");
        } else {
            alert("PDF generation library is loading. Please check your internet connection.");
        }
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // ----------------------------------------------------------------
        // 0. DATA SANITIZATION & PREPARATION
        // ----------------------------------------------------------------
        let rawPatientName = String(data.patient_name || data.patientName || data.name || "").trim();
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!rawPatientName || uuidPattern.test(rawPatientName)) {
            rawPatientName = "Patient";
        }
        const patientName = rawPatientName;

        const age = data.age ? String(data.age).trim() : "";
        const gender = data.gender ? String(data.gender).trim() : "";
        let ageGenderDisplay = "-";
        if (age && gender) {
            ageGenderDisplay = `${age} Yrs (${gender})`;
        } else if (age) {
            ageGenderDisplay = `${age} Yrs`;
        } else if (gender) {
            ageGenderDisplay = `${gender}`;
        }

        let doctorName = String(data.doctor_name || data.doctorName || "SmileCare Specialist").trim();
        if (doctorName && !/^dr\.?\s+/i.test(doctorName)) {
            doctorName = "Dr. " + doctorName;
        }

        const appointmentDateRaw = String(data.appointment_date || data.appointmentDate || "").trim();
        const readableDate = formatReadableDate(appointmentDateRaw);

        const appointmentTime = String(data.appointment_time || data.appointmentTime || "-").trim();
        const issue = String(data.issue || "-").trim();
        const status = String(data.status || "Pending").trim();

        let rawBookingId = String(data.id || "N/A").trim();
        const truncatedBookingId = rawBookingId.length > 20 ? rawBookingId.substring(0, 20) + "..." : rawBookingId;


        // ----------------------------------------------------------------
        // 1. HEADER SECTION (Top Band)
        // ----------------------------------------------------------------
        // Main Header Band (#0f766e Dark Teal)
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 0, 210, 34, "F");

        // Layered Accent Line (#0d9488 Teal)
        doc.setFillColor(13, 148, 136);
        doc.rect(0, 30, 210, 4, "F");

        // Golden/Amber Line (#f59e0b) below header
        doc.setFillColor(245, 158, 11);
        doc.rect(0, 34, 210, 1.5, "F");

        // Left Side: White Rounded Square Box (Logo Box ~40x40px = 13.5x13.5mm)
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 7, 14, 14, 2.5, 2.5, "F");

        // Simple Tooth Icon / Brand Mark inside White Box
        doc.setFillColor(13, 148, 136);
        doc.circle(21, 14, 4.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("S", 21, 17.2, { align: "center" });

        // Logo Title: "SmileCare" (White) + "Dental" (Light Teal #99f6e4)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("SmileCare ", 32, 16);

        const smileCareWidth = doc.getTextWidth("SmileCare ");
        doc.setTextColor(153, 246, 228); // #9df6e4ff
        doc.text("Dental", 32 + smileCareWidth, 16);

        // Tagline below title
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(204, 251, 241); // #ccfbf1
        doc.text("Your Smile, Our Priority", 32, 23);

        // Right Side Header Text: "APPOINTMENT SLIP" & "Confirmation Document"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("APPOINTMENT SLIP", 196, 15, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(204, 251, 241);
        doc.text("Confirmation Document", 196, 21, { align: "right" });


        // ----------------------------------------------------------------
        // 2. BODY SECTION (Title, Booking ID & Status Badge)
        // ----------------------------------------------------------------
        const bodyTopY = 46;

        // Heading: "Appointment Confirmation"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16.5);
        doc.setTextColor(15, 23, 42); // #0f172a Dark Text
        doc.text("Appointment Confirmation", 14, bodyTopY);

        // Sub-heading: Booking ID
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139); // #64748b Grey
        doc.text(`Booking ID: ${truncatedBookingId}`, 14, bodyTopY + 6);

        // Status Badge (Top Right of Body Section)
        const upperStatus = status.toUpperCase();
        let badgeBg = [219, 234, 254];      // Default Light Blue (#dbeafe)
        let badgeTextColor = [30, 64, 175];  // Dark Blue (#1e40af)

        if (upperStatus === "COMPLETED") {
            badgeBg = [220, 252, 231];        // Light Green (#dcfce7)
            badgeTextColor = [21, 128, 61];   // Green (#15803d)
        } else if (upperStatus === "CANCELLED") {
            badgeBg = [255, 228, 230];        // Light Red (#ffe4e6)
            badgeTextColor = [190, 18, 60];   // Dark Red (#be123c)
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        const badgePadding = 5;
        const textWidth = doc.getTextWidth(upperStatus);
        const badgeWidth = textWidth + (badgePadding * 2);
        const badgeHeight = 7.5;
        const badgeX = 196 - badgeWidth;
        const badgeY = bodyTopY - 4;

        doc.setFillColor(...badgeBg);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 2, 2, "F");
        doc.setTextColor(...badgeTextColor);
        doc.text(upperStatus, badgeX + (badgeWidth / 2), badgeY + 5.2, { align: "center" });


        // ----------------------------------------------------------------
        // 3. TWO-COLUMN GRID OF 6 CARDS
        // ----------------------------------------------------------------
        const gridTopY = 60;
        const cardWidth = 88;
        const cardHeight = 31;
        const col1X = 14;
        const col2X = 108;
        const rowGap = 36;

        const cards = [
            // Row 1
            { col: 1, row: 0, label: "PATIENT NAME", value: patientName },
            { col: 2, row: 0, label: "AGE / GENDER", value: ageGenderDisplay },
            // Row 2
            { col: 1, row: 1, label: "ASSIGNED DOCTOR", value: doctorName },
            { col: 2, row: 1, label: "APPOINTMENT DATE", value: readableDate },
            // Row 3
            { col: 1, row: 2, label: "APPOINTMENT TIME", value: appointmentTime },
            { col: 2, row: 2, label: "ISSUE / PROBLEM", value: issue }
        ];

        cards.forEach(c => {
            const x = c.col === 1 ? col1X : col2X;
            const y = gridTopY + (c.row * rowGap);

            // Card Background (#f8fafc Off-white)
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, "F");

            // Card Border (#e2e8f0 Light Grey)
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, "D");

            // Label (Teal, Bold, Uppercase, Font Size 8)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(13, 148, 136); // #0d9488
            doc.text(c.label, x + 5, y + 8);

            // Value (Dark Slate, Bold, Font Size 11)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42); // #0f172a

            // Wrap multi-line text cleanly if text exceeds card width
            const splitVal = doc.splitTextToSize(String(c.value), cardWidth - 10);
            doc.text(splitVal, x + 5, y + 16);
        });


        // ----------------------------------------------------------------
        // 4. NOTE BOX
        // ----------------------------------------------------------------
        const noteY = gridTopY + (3 * rowGap) + 2; // Y = 170mm
        const noteWidth = 182;
        const noteHeight = 17;

        // Background (#f0fdfa Light Teal)
        doc.setFillColor(240, 253, 250);
        doc.roundedRect(14, noteY, noteWidth, noteHeight, 2, 2, "F");

        // Border (#99f6e4)
        doc.setDrawColor(153, 246, 228);
        doc.setLineWidth(0.4);
        doc.roundedRect(14, noteY, noteWidth, noteHeight, 2, 2, "D");

        // Note Text (Dark Teal #0f766e)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 118, 110);
        doc.text("Note:", 18, noteY + 7);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const noteMsg = "Please arrive 10 minutes before your scheduled appointment time. Carry any previous prescriptions or X-rays if available.";
        const splitNote = doc.splitTextToSize(noteMsg, noteWidth - 22);
        doc.text(splitNote, 27, noteY + 7);


        // ----------------------------------------------------------------
        // 5. FOOTER SECTION (Bottom Band)
        // ----------------------------------------------------------------
        const footerY = 277;
        const footerHeight = 20;

        // Footer Band Background (#f3f4f6 Light Grey)
        doc.setFillColor(243, 244, 246);
        doc.rect(0, footerY, 210, footerHeight, "F");

        // Top Teal Border Line (#0d9488)
        doc.setFillColor(13, 148, 136);
        doc.rect(0, footerY, 210, 0.8, "F");

        // Footer Title: "SmileCare Dental Clinic"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 118, 110); // Dark Teal
        doc.text("SmileCare Dental Clinic", 105, footerY + 7, { align: "center" });

        // Footer Contact Line
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139); // Grey
        doc.text("123 Health Avenue, Medical City  |  +91 98765 43210  |  www.smilecaredental.com", 105, footerY + 12, { align: "center" });


        // ----------------------------------------------------------------
        // 6. FILENAME & SAVE (Format: Appointment_[PatientName]_[Date].pdf)
        // ----------------------------------------------------------------
        const cleanPatientName = patientName.replace(/\s+/g, "");
        const formattedDateStr = String(appointmentDateRaw || "").trim().split("T")[0] || new Date().toISOString().split("T")[0];

        const fileName = `Appointment_${cleanPatientName}_${formattedDateStr}.pdf`;

        // Direct 1-click download with exact filename and .pdf extension using jsPDF built-in save
        doc.save(fileName);

        if (typeof showToast === "function") {
            showToast(`Downloaded: ${fileName}`, "success");
        }

    } catch (err) {
        console.error("PDF Generation Exception:", err);
        if (typeof showToast === "function") {
            showToast("Failed to generate PDF slip: " + err.message, "error");
        } else {
            alert("Error generating PDF: " + err.message);
        }
    }
};

// --------------------------------------------------------------------
// HELPER: Format date to readable string (e.g. "2026-09-12" -> "12 September 2026")
// --------------------------------------------------------------------
function formatReadableDate(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    try {
        const cleanDateStr = String(dateStr).trim().split("T")[0];
        const parts = cleanDateStr.split("-");
        if (parts.length === 3) {
            const year = parts[0];
            const monthIndex = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            if (monthIndex >= 0 && monthIndex < 12) {
                return `${day} ${months[monthIndex]} ${year}`;
            }
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

// --------------------------------------------------------------------
// GLOBAL TRIGGERS FOR HTML ONCLICK BUTTONS
// --------------------------------------------------------------------
window.triggerPdfDownload = function (id, patientName, age, gender, mobile, doctorName, date, time, issue, status) {
    if (typeof generateAppointmentPDF === "function") {
        generateAppointmentPDF({
            id: id || 'N/A',
            patient_name: patientName || 'Patient',
            age: age || '-',
            gender: gender || '-',
            mobile: mobile || '-',
            doctor_name: doctorName || 'SmileCare Specialist',
            appointment_date: date || new Date().toISOString().split("T")[0],
            appointment_time: time || '-',
            issue: issue || '-',
            status: status || 'Pending'
        });
    }
};

// Smart Attached Document Viewer / Downloader
window.viewPatientDocument = function (url, patientName) {
    if (!url) return;
    try {
        // Open direct storage URL so browser detects proper content type and extension
        const win = window.open(url, "_blank");
        if (!win || win.closed || typeof win.closed === "undefined") {
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.download = "";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (err) {
        console.warn("Could not open link:", err);
        window.location.href = url;
    }
};

// ====================================================================
// DOCTOR'S TREATMENT REPORT PDF GENERATOR
// ====================================================================
window.generateTreatmentReportPDF = function (data) {
    if (!data) data = {};

    if (!window.jspdf || !window.jspdf.jsPDF) {
        if (typeof showToast === "function") {
            showToast("PDF generation library is loading. Please try again in a moment.", "error");
        } else {
            alert("PDF generation library is loading. Please check your internet connection.");
        }
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        // 0. DATA SANITIZATION
        let rawPatientName = String(data.patient_name || data.patientName || data.name || "").trim();
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!rawPatientName || uuidPattern.test(rawPatientName)) {
            rawPatientName = "Patient";
        }
        const patientName = rawPatientName;

        const age = data.age ? String(data.age).trim() : "";
        const gender = data.gender ? String(data.gender).trim() : "";

        let doctorName = String(data.doctor_name || data.doctorName || "SmileCare Specialist").trim();
        if (doctorName && !/^dr\.?\s+/i.test(doctorName)) {
            doctorName = "Dr. " + doctorName;
        }

        const appointmentDateRaw = String(data.appointment_date || data.appointmentDate || "").trim();
        const readableDate = formatReadableDate(appointmentDateRaw);

        const diagnosis = String(data.diagnosis || "Not specified").trim();
        const medicine = String(data.medicine || "Not specified").trim();
        const nextVisitRaw = String(data.next_visit_date || data.nextVisitDate || "").trim();
        const nextVisitDisplay = (nextVisitRaw && nextVisitRaw !== "-") ? formatReadableDate(nextVisitRaw) : "As needed / Not specified";

        let rawBookingId = String(data.id || "N/A").trim();
        const truncatedBookingId = rawBookingId.length > 20 ? rawBookingId.substring(0, 20) + "..." : rawBookingId;


        // 1. HEADER SECTION (Top Band) - Exact Branding Reuse
        doc.setFillColor(15, 118, 110);
        doc.rect(0, 0, 210, 34, "F");

        doc.setFillColor(13, 148, 136);
        doc.rect(0, 30, 210, 4, "F");

        doc.setFillColor(245, 158, 11);
        doc.rect(0, 34, 210, 1.5, "F");

        // White Logo Box
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, 7, 14, 14, 2.5, 2.5, "F");

        doc.setFillColor(13, 148, 136);
        doc.circle(21, 14, 4.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text("S", 21, 17.2, { align: "center" });

        // "SmileCare Dental"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("SmileCare ", 32, 16);

        const smileCareWidth = doc.getTextWidth("SmileCare ");
        doc.setTextColor(153, 246, 228);
        doc.text("Dental", 32 + smileCareWidth, 16);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(204, 251, 241);
        doc.text("Your Smile, Our Priority", 32, 23);

        // Header Title Right Side (Date Set in Header)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text("TREATMENT REPORT", 196, 14, { align: "right" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(204, 251, 241);
        doc.text(`Date: ${readableDate}`, 196, 21, { align: "right" });


        // 2. BODY TITLE & PATIENT METADATA
        const bodyTopY = 46;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16.5);
        doc.setTextColor(15, 23, 42);
        doc.text("Doctor's Treatment Report", 14, bodyTopY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Booking ID: ${truncatedBookingId}`, 14, bodyTopY + 6);


        // Metadata Summary Box
        const metaY = 58;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, metaY, 182, 22, 2, 2, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.roundedRect(14, metaY, 182, 22, 2, 2, "D");

        // Column 1: Patient Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(13, 148, 136);
        doc.text("PATIENT NAME", 18, metaY + 7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(patientName, 18, metaY + 14);

        // Column 2: Attending Doctor (Expanded Width)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(13, 148, 136);
        doc.text("ATTENDING DOCTOR", 90, metaY + 7);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(doctorName, 90, metaY + 14);


        // 3. STRUCTURED TREATMENT DETAILS CARDS
        let currentY = 88;
        const fullCardWidth = 182;

        // CARD A: DIAGNOSIS
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);

        const splitDiag = doc.splitTextToSize(diagnosis, fullCardWidth - 12);
        const diagHeight = Math.max(22, (splitDiag.length * 5) + 12);

        doc.roundedRect(14, currentY, fullCardWidth, diagHeight, 2.5, 2.5, "F");
        doc.roundedRect(14, currentY, fullCardWidth, diagHeight, 2.5, 2.5, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(13, 148, 136);
        doc.text("DIAGNOSIS & OBSERVATION", 20, currentY + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(splitDiag, 20, currentY + 16);

        currentY += diagHeight + 8;


        // CARD B: MEDICINE / PRESCRIPTION
        const splitMed = doc.splitTextToSize(medicine, fullCardWidth - 12);
        const medHeight = Math.max(22, (splitMed.length * 5) + 12);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, currentY, fullCardWidth, medHeight, 2.5, 2.5, "F");
        doc.roundedRect(14, currentY, fullCardWidth, medHeight, 2.5, 2.5, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(13, 148, 136);
        doc.text("MEDICINE & PRESCRIPTION INSTRUCTIONS", 20, currentY + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(splitMed, 20, currentY + 16);

        currentY += medHeight + 8;


        // CARD C: NEXT VISIT DATE
        doc.setFillColor(240, 253, 250);
        doc.setDrawColor(153, 246, 228);
        doc.roundedRect(14, currentY, fullCardWidth, 18, 2.5, 2.5, "F");
        doc.roundedRect(14, currentY, fullCardWidth, 18, 2.5, 2.5, "D");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 118, 110);
        doc.text("RECOMMENDED NEXT VISIT DATE", 20, currentY + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(nextVisitDisplay, 20, currentY + 14);


        // 4. FOOTER SECTION
        const footerY = 277;
        const footerHeight = 20;

        doc.setFillColor(243, 244, 246);
        doc.rect(0, footerY, 210, footerHeight, "F");

        doc.setFillColor(13, 148, 136);
        doc.rect(0, footerY, 210, 0.8, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(15, 118, 110);
        doc.text("SmileCare Dental Clinic", 105, footerY + 7, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("123 Health Avenue, Medical City  |  +91 98765 43210  |  www.smilecaredental.com", 105, footerY + 13, { align: "center" });


        // 5. SAVE WITH CLEAN FILENAME (Format: Treatment_Report_[PatientName]_[Date].pdf)
        const cleanPatientName = patientName.replace(/\s+/g, "");
        const formattedDateStr = String(appointmentDateRaw || "").trim().split("T")[0] || new Date().toISOString().split("T")[0];

        const fileName = `Treatment_Report_${cleanPatientName}_${formattedDateStr}.pdf`;

        doc.save(fileName);

        if (typeof showToast === "function") {
            showToast(`Downloaded: ${fileName}`, "success");
        }

    } catch (err) {
        console.error("Treatment Report PDF Generation Exception:", err);
        if (typeof showToast === "function") {
            showToast("Failed to generate Treatment Report PDF: " + err.message, "error");
        } else {
            alert("Error generating PDF: " + err.message);
        }
    }
};

window.triggerTreatmentReportPdfDownload = function (id, patientName, doctorName, date, diagnosis, medicine, nextVisitDate, age, gender) {
    if (typeof generateTreatmentReportPDF === "function") {
        generateTreatmentReportPDF({
            id: id || 'N/A',
            patient_name: patientName || 'Patient',
            doctor_name: doctorName || 'SmileCare Specialist',
            appointment_date: date || new Date().toISOString().split("T")[0],
            diagnosis: diagnosis || '',
            medicine: medicine || '',
            next_visit_date: nextVisitDate || '',
            age: age || '',
            gender: gender || ''
        });
    }
};

