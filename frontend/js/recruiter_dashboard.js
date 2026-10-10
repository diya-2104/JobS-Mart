const userId   = localStorage.getItem("user_id");
const userName = localStorage.getItem("user_name");
const userRole = localStorage.getItem("user_role");

if (!userId || userRole !== "recruiter") {
    window.location.href = "login.html";
}

// Display user info
document.getElementById("userName").textContent = userName || "Recruiter";
document.getElementById("userAvatar").textContent = (userName || "R").charAt(0).toUpperCase();

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_role");
    window.location.href = "login.html";
});

// Smooth scroll for "Post a Job" nav link
document.getElementById("navPostJob").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("post-job").scrollIntoView({ behavior: "smooth" });
});

let allCandidates = [];
let currentJobId  = null;


// =========================================================
// LOAD DASHBOARD STATS + JOBS ON PAGE LOAD
// =========================================================

async function init() {
    await loadStats();
    await loadMyJobs();
}


async function loadStats() {
    try {
        const res  = await fetch(`http://127.0.0.1:5000/api/recruiter/dashboard/${userId}`);
        const data = await res.json();
        if (!res.ok) return;
        document.getElementById("statJobs").textContent       = data.jobs_posted   || 0;
        document.getElementById("statApplicants").textContent = data.total_applicants || 0;
        document.getElementById("statApproved").textContent   = data.approved_count || 0;
        document.getElementById("statRejected").textContent   = data.rejected_count || 0;
    } catch (e) {
        console.error(e);
    }
}


// =========================================================
// LOAD MY JOBS
// =========================================================

async function loadMyJobs() {
    try {
        const res  = await fetch(`http://127.0.0.1:5000/api/recruiter/${userId}/jobs`);
        const jobs = await res.json();

        const container = document.getElementById("jobsList");

        if (!res.ok || !jobs.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💼</div>
                    <h3>No jobs posted yet</h3>
                    <p>Use the form above to post your first job opening.</p>
                </div>`;
            return;
        }

        container.innerHTML = jobs.map(job => `
            <div class="job-row" id="job-row-${job.job_id}">
                <div class="job-row-info">
                    <h3>${escapeHtml(job.title)}</h3>
                    <p>${escapeHtml(job.company || "—")} · Posted ${formatDate(job.created_at)}</p>
                </div>
                <div class="job-row-meta">
                    <span class="applicant-count">👥 ${job.applicant_count} applicant${job.applicant_count !== 1 ? "s" : ""}</span>
                    <button class="view-btn" onclick="viewCandidates(${job.job_id}, '${escapeHtml(job.title)}', '${escapeHtml(job.company || "")}')">
                        View Candidates
                    </button>
                </div>
            </div>`
        ).join("");

    } catch (e) {
        console.error(e);
    }
}


// =========================================================
// VIEW CANDIDATES FOR A JOB
// =========================================================

async function viewCandidates(jobId, title, company) {
    currentJobId = jobId;

    // Highlight selected job row
    document.querySelectorAll(".job-row").forEach(r => r.classList.remove("selected"));
    const row = document.getElementById(`job-row-${jobId}`);
    if (row) row.classList.add("selected");

    document.getElementById("selectedJobTitle").textContent   = title;
    document.getElementById("selectedJobCompany").textContent = company;

    const panel = document.getElementById("candidatesPanel");
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });

    // Reset filter to "all"
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    document.querySelector(".filter-tab[data-filter='all']").classList.add("active");

    try {
        const res  = await fetch(`http://127.0.0.1:5000/api/recruiter/jobs/${jobId}/candidates`);
        const data = await res.json();

        if (!res.ok) {
            renderCandidates([]);
            return;
        }

        allCandidates = data;
        renderCandidates(allCandidates);

    } catch (e) {
        console.error(e);
        renderCandidates([]);
    }
}


function closeCandidates() {
    document.getElementById("candidatesPanel").classList.add("hidden");
    document.querySelectorAll(".job-row").forEach(r => r.classList.remove("selected"));
    currentJobId  = null;
    allCandidates = [];
}


// =========================================================
// RENDER CANDIDATES
// =========================================================

function renderCandidates(list) {
    const container = document.getElementById("candidatesList");

    if (!list.length) {
        container.innerHTML = `
            <div class="no-candidates">
                <div>👥</div>
                <h3>No candidates found</h3>
                <p>No resumes have been matched to this job yet.</p>
            </div>`;
        return;
    }

    container.innerHTML = list.map(c => {
        const skills = (c.skills || []).slice(0, 5);
        const status = c.status || "pending";

        const actionBtns = status === "pending"
            ? `<button class="approve-btn" onclick="updateStatus(${c.match_id}, 'approved')">✓ Approve</button>
               <button class="reject-btn"  onclick="updateStatus(${c.match_id}, 'rejected')">✕ Reject</button>`
            : `<span class="status-badge status-${status}">${capitalize(status)}</span>`;

        return `
            <div class="candidate-row" id="candidate-${c.match_id}">
                <div class="candidate-avatar">${(c.candidate_name || "C").charAt(0).toUpperCase()}</div>
                <div class="candidate-info">
                    <h4>${escapeHtml(c.candidate_name)}</h4>
                    <p>${escapeHtml(c.candidate_email)} · Resume: ${escapeHtml(c.filename)}</p>
                    <div class="candidate-skills">
                        ${skills.map(s => `<span>${escapeHtml(s)}</span>`).join("")}
                        ${c.skills && c.skills.length > 5 ? `<span>+${c.skills.length - 5} more</span>` : ""}
                    </div>
                </div>
                <div class="candidate-score-col">
                    <span class="c-score">${c.match_score}%</span>
                    <span class="c-score-label">Match</span>
                </div>
                <div class="candidate-actions">${actionBtns}</div>
            </div>`;
    }).join("");
}


// =========================================================
// FILTER CANDIDATES
// =========================================================

function filterCandidates(filter, btn) {
    document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");

    const filtered = filter === "all"
        ? allCandidates
        : allCandidates.filter(c => (c.status || "pending") === filter);

    renderCandidates(filtered);
}


// =========================================================
// APPROVE / REJECT
// =========================================================

async function updateStatus(matchId, status) {
    try {
        const res = await fetch(`http://127.0.0.1:5000/api/recruiter/matches/${matchId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });

        if (!res.ok) return;

        // Update local state
        const candidate = allCandidates.find(c => c.match_id === matchId);
        if (candidate) candidate.status = status;

        // Re-render the single row
        const row = document.getElementById(`candidate-${matchId}`);
        if (row) {
            const actionsDiv = row.querySelector(".candidate-actions");
            actionsDiv.innerHTML = `<span class="status-badge status-${status}">${capitalize(status)}</span>`;
        }

        // Refresh stats
        await loadStats();

    } catch (e) {
        console.error(e);
    }
}


// =========================================================
// POST JOB FORM
// =========================================================

document.getElementById("postJobForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const title       = document.getElementById("jobTitle").value.trim();
    const company     = document.getElementById("jobCompany").value.trim();
    const description = document.getElementById("jobDescription").value.trim();
    const msgEl       = document.getElementById("jobMessage");

    msgEl.className = "r-message hidden";
    msgEl.textContent = "";

    try {
        const res  = await fetch("http://127.0.0.1:5000/api/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recruiter_id: userId, title, company, description })
        });

        const data = await res.json();

        msgEl.classList.remove("hidden");

        if (res.ok) {
            msgEl.classList.add("success");
            msgEl.textContent = `✓ "${data.title}" posted successfully!`;
            document.getElementById("postJobForm").reset();
            await loadMyJobs();
            await loadStats();
        } else {
            msgEl.classList.add("error");
            msgEl.textContent = data.message || "Failed to post job.";
        }

    } catch (e) {
        msgEl.classList.remove("hidden");
        msgEl.classList.add("error");
        msgEl.textContent = "Unable to connect to the server.";
    }
});


// =========================================================
// HELPERS
// =========================================================

function escapeHtml(v) {
    if (!v) return "";
    return String(v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}


init();
