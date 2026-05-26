if (
  "serviceWorker" in navigator
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").then(
      (registration) => {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope
        );
      },
      (err) => {
        console.log("ServiceWorker registration failed: ", err);
      }
    );
  });
}

const log = (level, message, ...args) => {
  console.log(`[${level.toUpperCase()}] [UI] ${message}`, ...args);
};

const instructions = [
  {
    title: "The Marquette Method",
    content: `<h3>Objective. Digital. Effective.</h3><p>This method removes human error by using the Clearblue Fertility Monitor to track two specific urinary hormones: Estrogen and LH.</p><p>Instead of guessing based on how you "feel," you get a concrete data point every morning. It’s about 98% effective with perfect use, largely because it doesn't rely on you analyzing your own mucus before you've had your coffee.</p>`
  },
  {
    title: "The Daily Routine",
    content: `<h3>The 6-Hour Window</h3><p>You must set a 6-hour testing window on your monitor (e.g., 6:00 AM – 12:00 PM). You can only test during this time.</p><h3>The Workflow:</h3><ul><li>Cycle Day 1-5: No testing.</li><li>Cycle Day 6: Begin testing.</li></ul><h3>The Action:</h3><p>Collect a urine sample, dip the test stick, and insert it into the monitor.</p><h3>The Wait:</h3><p>It takes 5 minutes to read.</p><p><em>Note: You will test every day until the fertile window closes.</em></p>`
  },
  {
    title: "The Three Readings",
    content: `<h3>Interpreting Your Data</h3><ol><li><strong>LOW (Infertile)</strong><br>Status: No hormone rise.<br>Action: Intercourse is available.</li><li><strong>HIGH (Fertile)</strong><br>Status: Estrogen is rising. The fertile window is OPEN.<br>Why: Sperm can survive up to 5 days waiting for the egg.<br>Action: Abstinence begins immediately.</li><li><strong>PEAK (Maximum Fertility)</strong><br>Status: LH Surge detected. Ovulation is imminent (24-36 hours).<br>Action: Continue abstinence. The monitor will automatically show "Peak" for two days.</li></ol>`
  },
  {
    title: "Closing the Window",
    content: `<h3>The "PPHLL" Rule</h3><p>You remain in the fertile window (abstinence) starting from the very first "High" reading. To exit, you must trigger the countdown starting on your first Peak day.</p><h3>The Countdown:</h3><ul><li>Peak (Day 1)</li><li>Peak (Day 2 - Automatic)</li><li>High (Wait Day 1)</li><li>Low (Wait Day 2)</li></ul><p>The Rule: On the evening of that 4th day (the second "Wait" day), the window is officially closed. You are safe to resume normal relations until the end of the cycle.</p>`
  },
  {
    title: "The Logic",
    content: `<h3>Calculating Your Window</h3><img src="/LHandEstrogen.png" alt="LH and Estrogen Chart" style="width:100%; display:block; margin:auto;"><p><b>The Equation: Ovulation Timing + Sperm Survival = Your Window</b></p><p>To stay safe, we combine real-time data with biological facts:</p><ul><li><b>The Event:</b> The Monitor identifies your Peak (when the egg actually releases).</li><li><b>The Risk:</b> Sperm can survive inside the body for 5 days waiting for that egg.</li><li><b>The Result:</b> The "High" readings track Estrogen to warn you before ovulation, covering the sperm survival time. The "Peak" tracks the actual event. Together, they define the fertile window you see in the chart above.</li></ul>`
  }
];

const infoData = {
  cycle_length: {
    title: "Average Cycle Length",
    content: "The average number of days from the first day of your period to the day before your next period begins. A typical cycle is between 21 and 35 days."
  },
  cycle_variation: {
    title: "Cycle Variation",
    content: "This shows how much your cycle length changes from month to month (standard deviation). A variation of up to 7 days is considered regular. Tracking this helps you understand the predictability of your cycle."
  },
  days_to_peak: {
    title: "Average Days to Peak",
    content: "The average number of days from the start of your cycle until your 'Peak' fertility day. This is a key indicator of when ovulation is likely to occur."
  },
  luteal_phase: {
    title: "Average Luteal Phase",
    content: "The luteal phase is the time between your Peak day and the start of your next period. A healthy luteal phase is typically 10-14 days and is crucial for sustaining early pregnancy."
  },
  fertile_window: {
    title: "Average Fertile Window",
    content: "The number of days in your cycle where intercourse is most likely to result in pregnancy, estimated based on your High and Peak readings."
  },
  lunar_pulse: {
    title: "How to Read The Lunar Pulse",
    content: "<img src='/lunar_infographic.png' alt='Lunar Pulse Infographic' style='width: 100%; border-radius: 8px; margin-bottom: 15px;'><br/><p>The Lunar Pulse is a visual representation of your current cycle. <br/><br/>The dot marks where you are today based on your average cycle length. Each phase represents different hormonal shifts. Tap any phase to learn about the science and the 'vibe' of that part of your cycle.</p>"
  },
  estimated_peak: {
    title: "Estimated Next Peak",
    content: "Our algorithm's prediction for the exact day your next hormone surge should occur, based on your historical Days to Peak average."
  }
};

let currentInstruction = 0;
let currentlyViewedUserId = null; // Track the user whose data is being viewed
let displayedCycleLimit = 2; // Pagination limit for cycles

document.addEventListener("DOMContentLoaded", () => {
  log("info", "DOM fully loaded and parsed.");
  initializeInstructionalOverlay();
  initializeInfoButtons();

  const appMenuToggle = document.getElementById("app-menu-toggle");
  const appMenuContent = document.getElementById("app-menu-content");

  if (appMenuToggle && appMenuContent) {
    appMenuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      appMenuToggle.classList.toggle("active");
      appMenuContent.classList.toggle("active");
    });

    document.addEventListener("click", (event) => {
      if (
        !appMenuContent.contains(event.target) &&
        !appMenuToggle.contains(event.target)
      ) {
        appMenuToggle.classList.remove("active");
        appMenuContent.classList.remove("active");
      }
    });
  }

  const readingForm = document.getElementById("reading-form");
  if (readingForm) {
    const elements = {
      periodButton: document.getElementById("period-button"),
      cyclesContainer: document.getElementById("cycles-container"),
      avgCycleLengthSpan: document.getElementById("avg-cycle-length"),
      avgDaysToPeakSpan: document.getElementById("avg-days-to-peak"),
      dateInput: document.getElementById("date"),
      periodStartDateInput: document.getElementById("period-start-date"),
      rangeCheckbox: document.getElementById("range-checkbox"),
      rangeInputs: document.getElementById("range-inputs"),
      endDateInput: document.getElementById("end-date"),
      readingForm: readingForm
    };

    initializeEventListeners(elements);
    elements.periodStartDateInput.value = new Date().toISOString().split("T")[0];
    elements.dateInput.value = new Date().toISOString().split("T")[0];
    fetchAndRenderData(elements);
  }
});

function initializeInstructionalOverlay() {
  log("info", "--- initializeInstructionalOverlay START ---");
  log("info", "Instructions array content:", JSON.stringify(instructions));
  const overlay = document.getElementById("instructional-overlay");
  if (!overlay) {
    log(
      "warn",
      "Instructional overlay element not found. --- initializeInstructionalOverlay END ---"
    );
    return;
  }

  const closeBtn = document.getElementById("close-instructions");
  const nextBtn = document.getElementById("next-instruction");
  const prevBtn = document.getElementById("prev-instruction");

  const closeOverlay = () => {
    overlay.classList.remove("active");
    // Make an API call to permanently mark instructions as viewed
    fetch("/api/instructions-viewed", { method: "POST" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to update instructions status");
        }
        log("info", "Successfully updated instructions status on the server.");
      })
      .catch((error) => console.error("Error updating instructions status:", error));
  };

  closeBtn.addEventListener("click", closeOverlay);

  nextBtn.addEventListener("click", () => {
    if (currentInstruction < instructions.length - 1) {
      currentInstruction++;
      renderInstruction();
    } else {
      closeOverlay();
    }
  });

  prevBtn.addEventListener("click", () => {
    if (currentInstruction > 0) {
      currentInstruction--;
      renderInstruction();
    }
  });
}

const lunarPulseData = {
  Menstrual: {
    Title: "The Hibernation Phase",
    The_Science: "Estrogen and progesterone are at their lowest baseline. The body is shedding the uterine lining, which requires a significant amount of baseline energy.",
    The_Vibe: "Cancel the non-essential meetings. Biology dictates low energy, and reality dictates sweatpants with zero guilt about leaving texts on read. It's time for introversion, weighted blankets, and low-stakes choices.",
    ColorClass: "menstrual-segment"
  },
  Follicular: {
    Title: "The Main Character Phase",
    The_Science: "The brain is pumping out follicle-stimulating hormone (FSH), and estrogen is beginning a steep, steady climb, bringing serotonin and dopamine along for the ride.",
    The_Vibe: "The fog has lifted. You are biologically primed to be charming, tackle complex tasks, and actually want to answer your emails. A great time to brainstorm, socialize, or finally fold the laundry that's been sitting in the basket for three days.",
    ColorClass: "follicular-segment"
  },
  Ovulatory: {
    Title: "The Peak Phase",
    The_Science: "Estrogen hits its absolute ceiling, triggering a surge of luteinizing hormone (LH) to release the egg. A brief, sharp spike in testosterone also occurs.",
    The_Vibe: "Peak magnetism and high confidence. You are at your most articulate and sharp. If you need to negotiate a raise, ask for a massive favor, or win a petty debate about household chores, your biological success rate is currently maxed out.",
    ColorClass: "ovulatory-segment"
  },
  Luteal: {
    Title: "The \"Handle With Care\" Phase",
    The_Science: "The follicle that released the egg becomes the corpus luteum, which pumps out progesterone. Progesterone has a sedative effect, but the simultaneous sharp drop in estrogen can cause a withdrawal effect, lowering serotonin.",
    The_Vibe: "You are not actually furious at the way people breathe; it is just the progesterone talking. Brain fog and sensitivity are the default settings right now. The world might feel about 20% more annoying than it actually is, so be gentle with yourself and lower your expectations of others.",
    ColorClass: "luteal-segment"
  }
};

function renderLunarPulse(analytics, cycles) {
  const container = document.getElementById('lunar-donut-container');
  const overlay = document.getElementById('vibe-modal-overlay');
  if (!container || !overlay) return;

  // 1. Calculate Averages & Fertile Window Length Strictly Based on Last 6 Cycles
  const recentCycles = cycles || [];
  const completedCycles = recentCycles.filter(c => c.end_date).slice(0, 6);
  
  // Calculate average cycle length from the 6 most recent completed cycles
  let avgCycleLength = 28; // Default fallback
  if (completedCycles.length > 0) {
    const totalDays = completedCycles.reduce((acc, c) => {
      const start = new Date(c.start_date.split('T')[0]);
      const end = new Date(c.end_date.split('T')[0]);
      return acc + Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }, 0);
    avgCycleLength = Math.round(totalDays / completedCycles.length);
  } else if (analytics.averageCycleLength > 0) {
    avgCycleLength = analytics.averageCycleLength;
  }

  // Calculate average days to peak fertility from the 6 most recent cycles
  let avgDaysToPeak = 14; // Default fallback
  const recentCyclesForPeak = recentCycles.slice(0, 6);
  let totalDaysToPeak = 0;
  let peakCyclesCount = 0;

  recentCyclesForPeak.forEach(c => {
    if (!c.days) return;
    const peakDay = c.days.find(d => d.hormone_reading === 'Peak');
    if (peakDay) {
      const start = new Date(c.start_date.split('T')[0]);
      const peak = new Date(peakDay.date.split('T')[0]);
      const dayIndex = Math.round((peak - start) / (1000 * 60 * 60 * 24)) + 1;
      totalDaysToPeak += dayIndex;
      peakCyclesCount++;
    }
  });

  if (peakCyclesCount > 0) {
    avgDaysToPeak = Math.round(totalDaysToPeak / peakCyclesCount);
  } else if (analytics.averageDaysToPeak > 0) {
    avgDaysToPeak = analytics.averageDaysToPeak;
  }

  let avgFertileWindowLength = 5; // Default fallback
  const fertileWindows = calculateFertileWindows(cycles);
  const validWindows = fertileWindows.filter((fw) => fw.start && fw.end);
  if (validWindows.length > 0) {
    const totalFertileDays = validWindows.reduce((acc, fw) => {
      const start = new Date(fw.start);
      const end = new Date(fw.end);
      return acc + (end - start) / (1000 * 60 * 60 * 24) + 1;
    }, 0);
    avgFertileWindowLength = Math.round(totalFertileDays / validWindows.length);
  }

  // 2. Day Mapping
  const menstrualDays = 5;
  const ovulatoryDays = avgFertileWindowLength > 0 ? avgFertileWindowLength : 5;
  const follicularStart = menstrualDays + 1;
  const ovulatoryStart = Math.max(follicularStart + 1, avgDaysToPeak - Math.floor(ovulatoryDays / 2));
  const follicularDays = Math.max(1, ovulatoryStart - follicularStart);
  const lutealDays = Math.max(1, avgCycleLength - (menstrualDays + follicularDays + ovulatoryDays));

  // Determine percentages
  const totalMappedDays = menstrualDays + follicularDays + ovulatoryDays + lutealDays;
  const pMenstrual = (menstrualDays / totalMappedDays);
  const pFollicular = (follicularDays / totalMappedDays);
  const pOvulatory = (ovulatoryDays / totalMappedDays);
  const pLuteal = (lutealDays / totalMappedDays);

  const angle1 = pMenstrual * 360;
  const angle2 = angle1 + (pFollicular * 360);
  const angle3 = angle2 + (pOvulatory * 360);
  const angle4 = 360;

  // 3. Date Calculations
  let cycleStart = new Date();
  if (cycles && cycles.length > 0) cycleStart = new Date(cycles[0].start_date);

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days - 1);
    return d;
  };
  const formatDate = (date) => `${date.getMonth()+1}/${date.getDate()}`;

  const dMenstrualEnd = addDays(cycleStart, menstrualDays);
  const dFollicularEnd = addDays(cycleStart, menstrualDays + follicularDays);
  const dOvulatoryEnd = addDays(cycleStart, menstrualDays + follicularDays + ovulatoryDays);
  const dLutealEnd = addDays(cycleStart, avgCycleLength);

  lunarPulseData['Menstrual'].Dates = `${formatDate(cycleStart)} - ${formatDate(dMenstrualEnd)}`;
  lunarPulseData['Follicular'].Dates = `${formatDate(addDays(cycleStart, menstrualDays+1))} - ${formatDate(dFollicularEnd)}`;
  lunarPulseData['Ovulatory'].Dates = `${formatDate(addDays(cycleStart, menstrualDays+follicularDays+1))} - ${formatDate(dOvulatoryEnd)}`;
  lunarPulseData['Luteal'].Dates = `${formatDate(addDays(cycleStart, menstrualDays+follicularDays+ovulatoryDays+1))} - ${formatDate(dLutealEnd)}`;

  // Find Current Phase & Marker Angle
  const today = new Date();
  let currentDay = Math.floor((today - cycleStart) / (1000 * 60 * 60 * 24)) + 1;
  // If user is past their average cycle, cap it at 359 degrees so it doesn't wrap confusingly
  const clampedDay = currentDay > avgCycleLength ? avgCycleLength : currentDay;
  const currentAngleDeg = Math.min((clampedDay / avgCycleLength) * 360, 359.9);

  let currentPhase = "Menstrual";
  if (currentDay > menstrualDays) currentPhase = "Follicular";
  if (currentDay > menstrualDays + follicularDays) currentPhase = "Ovulatory";
  if (currentDay > menstrualDays + follicularDays + ovulatoryDays) currentPhase = "Luteal";

  // 4. SVG Math
  const polarToCartesian = (cx, cy, r, angleDeg) => {
    const angleRad = (angleDeg - 90) * Math.PI / 180.0;
    return { x: cx + (r * Math.cos(angleRad)), y: cy + (r * Math.sin(angleRad)) };
  };
  
  const describeArc = (x, y, r, startAngle, endAngle) => {
    // subtract 0.1 from endAngle to prevent arc overlapping/disappearing at exactly 360
    const start = polarToCartesian(x, y, r, endAngle - 0.1); 
    const end = polarToCartesian(x, y, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const cx = 50, cy = 50, radius = 35;
  const marker = polarToCartesian(cx, cy, radius, currentAngleDeg);

  const drawTick = (angle, label) => {
    const inner = polarToCartesian(cx, cy, radius - 4, angle);
    const outer = polarToCartesian(cx, cy, radius + 4, angle);
    let textPos = polarToCartesian(cx, cy, radius + 11, angle);
    let anchor = "middle";
    
    // Stagger dates at top to prevent overlap
    if (angle === 0) {
      textPos = polarToCartesian(cx, cy, radius + 8, angle);
      textPos.x += 2;
      anchor = "start";
    } else if (angle >= 359) {
      textPos = polarToCartesian(cx, cy, radius + 8, angle);
      textPos.x -= 2;
      anchor = "end";
    }

    return `
      <line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="var(--md-sys-color-outline)" stroke-width="1" />
      <text x="${textPos.x}" y="${textPos.y + 1.5}" class="chart-tick-text" text-anchor="${anchor}" fill="var(--md-sys-color-outline)" font-size="3">${label}</text>
    `;
  };

  // Generate SVG String
  container.innerHTML = `
    <svg viewBox="0 0 100 100" class="circular-chart-v2" style="display: block; margin: 0 auto; max-width: 100%; max-height: 300px;">
      <path class="circle-segment menstrual-segment" d="${describeArc(cx, cy, radius, 0, angle1)}" data-phase="Menstrual" stroke-width="6" fill="none" />
      <path class="circle-segment follicular-segment" d="${describeArc(cx, cy, radius, angle1, angle2)}" data-phase="Follicular" stroke-width="6" fill="none" />
      <path class="circle-segment ovulatory-segment" d="${describeArc(cx, cy, radius, angle2, angle3)}" data-phase="Ovulatory" stroke-width="6" fill="none" />
      <path class="circle-segment luteal-segment" d="${describeArc(cx, cy, radius, angle3, 359.9)}" data-phase="Luteal" stroke-width="6" fill="none" />
      
      <!-- Date Ticks -->
      ${drawTick(0, formatDate(cycleStart))}
      ${drawTick(angle1, formatDate(dMenstrualEnd))}
      ${drawTick(angle2, formatDate(dFollicularEnd))}
      ${drawTick(angle3, formatDate(dOvulatoryEnd))}
      ${drawTick(359.9, formatDate(dLutealEnd))}

      <!-- Estimated Next Peak Marker -->
      ${(() => {
        if (analytics && analytics.averageDaysToPeak > 0) {
          const hasPeaked = cycles[0] && cycles[0].days && cycles[0].days.some(d => d.hormone_reading === 'Peak');
          if (!hasPeaked && currentDay <= avgCycleLength) {
            // Predict peak day inside current cycle
            const estPeakDay = analytics.averageDaysToPeak;
            if (estPeakDay <= avgCycleLength) {
              const peakAngle = Math.min((estPeakDay / avgCycleLength) * 360, 359.9);
              const peakMarker = polarToCartesian(cx, cy, radius, peakAngle);
              const peakText = polarToCartesian(cx, cy, radius + 14, peakAngle);
              const estPeakDate = addDays(cycleStart, estPeakDay);
              return `
                <circle cx="${peakMarker.x}" cy="${peakMarker.y}" r="2" fill="none" stroke="#f57c00" stroke-width="0.8" stroke-dasharray="1,1" />
                <path d="M ${peakMarker.x} ${peakMarker.y-3} L ${peakMarker.x+2} ${peakMarker.y+1} L ${peakMarker.x-2} ${peakMarker.y+1} Z" fill="#f57c00" />
                <text x="${peakText.x}" y="${peakText.y}" fill="#f57c00" font-size="2.5" text-anchor="middle" font-weight="700">Est. Peak</text>
                <text x="${peakText.x}" y="${peakText.y + 3}" fill="#f57c00" font-size="2.5" text-anchor="middle" font-weight="500">${formatDate(estPeakDate)}</text>
              `;
            }
          }
        }
        return '';
      })()}

      <!-- Today Marker -->
      <circle cx="${marker.x}" cy="${marker.y}" r="2.5" class="today-marker" fill="var(--md-sys-color-on-surface)" stroke="var(--md-sys-color-surface)" stroke-width="1" />
      
      <!-- Center Text -->
      <text x="50" y="48" fill="var(--md-sys-color-on-surface)" text-anchor="middle" font-size="6" font-weight="700">${currentPhase}</text>
      <text x="50" y="55" fill="var(--md-sys-color-outline)" text-anchor="middle" font-size="4">Day ${currentDay}</text>
    </svg>
  `;

  // 5. Attach Events
  const segments = container.querySelectorAll('.circle-segment');
  const vibeModal = overlay.querySelector('.vibe-modal');
  const titleEl = document.getElementById('vibe-title');
  const datesEl = document.getElementById('vibe-dates');
  const scienceEl = document.getElementById('vibe-science');
  const textEl = document.getElementById('vibe-text');

  segments.forEach(segment => {
    segment.addEventListener('click', (e) => {
      e.stopPropagation();
      const phaseId = segment.getAttribute('data-phase');
      const data = lunarPulseData[phaseId];
      if (data) {
        titleEl.textContent = data.Title;
        datesEl.textContent = data.Dates;
        scienceEl.textContent = data.The_Science;
        textEl.textContent = data.The_Vibe;
        
        let color = '#74777f';
        if (phaseId === 'Menstrual') color = '#d32f2f';
        if (phaseId === 'Follicular') color = '#1976d2';
        if (phaseId === 'Ovulatory') color = '#f57c00';
        if (phaseId === 'Luteal') color = '#8e24aa';
        vibeModal.style.borderColor = color;
        titleEl.style.color = color;
        datesEl.style.color = color;

        overlay.classList.add('active');
      }
    });
  });

  const closeOverlay = () => { overlay.classList.remove('active'); };
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });
  
  let touchstartY = 0;
  overlay.addEventListener('touchstart', e => { touchstartY = e.changedTouches[0].screenY; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    if (e.changedTouches[0].screenY - touchstartY > 50) closeOverlay();
  }, { passive: true });
}

function renderInstruction() {
  log("info", `--- renderInstruction START (Current Index: ${currentInstruction}) ---`);
  if (currentInstruction >= instructions.length) {
    log(
      "error",
      `Invalid instruction index: ${currentInstruction}. Instructions length: ${instructions.length}`
    );
    return;
  }
  const instruction = instructions[currentInstruction];
  log("info", "Rendering instruction:", JSON.stringify(instruction));
  document.getElementById("instruction-title").textContent = instruction.title;
  document.getElementById("instruction-content").innerHTML = instruction.content;

  const pageIndicator = document.getElementById("page-indicator");
  pageIndicator.textContent = `Page ${currentInstruction + 1} of ${instructions.length}`;

  const progressBar = document.getElementById("progress-bar");
  const progress = ((currentInstruction + 1) / instructions.length) * 100;
  progressBar.style.width = `${progress}%`;

  const prevBtn = document.getElementById("prev-instruction");
  prevBtn.style.display = currentInstruction === 0 ? "none" : "inline-block";

  const nextBtn = document.getElementById("next-instruction");
  if (currentInstruction === instructions.length - 1) {
    nextBtn.textContent = "Finish";
  } else {
    nextBtn.textContent = "Next";
  }
  log("info", "--- renderInstruction END ---");
}

function initializeEventListeners(elements) {
  elements.rangeCheckbox.addEventListener("change", () => {
    if (elements.rangeCheckbox.checked) {
      elements.rangeInputs.style.display = "block";
      // Jump today's date from start Date box to the End Date box
      elements.endDateInput.value = elements.dateInput.value;
      // Clear start Date box for manual beginning date input
      elements.dateInput.value = "";
    } else {
      elements.rangeInputs.style.display = "none";
      // Restore today's date back to the start Date box and clear end date
      elements.dateInput.value = new Date().toISOString().split("T")[0];
      elements.endDateInput.value = "";
    }
  });

  elements.readingForm.addEventListener("submit", (e) =>
    handleReadingSubmit(e, elements)
  );
  elements.periodButton.addEventListener("click", () =>
    handleNewCycleSubmit(elements)
  );
}

async function fetchAndRenderData(elements, viewAsUserId = null) {
  // If no specific view is requested, fetch /api/me first to determine default
  if (!viewAsUserId && !currentlyViewedUserId) {
    try {
      const meRes = await fetch(`/api/me?t=${new Date().getTime()}`);
      if (meRes.ok) {
        const me = await meRes.json();
        currentlyViewedUserId = me.default_view_user_id || me.id;
        viewAsUserId = currentlyViewedUserId;
      }
    } catch(err) {} 
  } else {
    currentlyViewedUserId = viewAsUserId || currentlyViewedUserId;
  }
  log("info", `[START] fetchAndRenderData: Fetching data for user: ${currentlyViewedUserId}.`);
  try {
    const cacheBust = `?t=${new Date().getTime()}`;
    const userQuery = viewAsUserId ? `?user_id=${viewAsUserId}` : "";
    log(
      "info",
      `[FETCH] URLs being fetched: /api/me, /api/cycles${userQuery}, /api/analytics${userQuery}`
    );

    const responses = await Promise.all([
      fetch(`/api/me${cacheBust}`),
      fetch(`/api/cycles${userQuery}${userQuery ? "&" : "?"}t=${cacheBust}`),
      fetch(`/api/analytics${userQuery}${userQuery ? "&" : "?"}t=${cacheBust}`)
    ]);

    log("info", "[FETCH] All fetch promises have resolved.");

    for (const response of responses) {
      if (response.status === 401) {
        log("error", "[AUTH] User not authenticated (401). Redirecting to login.");
        window.location.href = "/?auth=expired";
        return;
      }
    }

    log("info", "[FETCH] All responses are OK. Parsing JSON...");
    const [user, cycles, analytics] = await Promise.all(
      responses.map((res) => res.json())
    );

    log(
      "info",
      `[DATA] Logged-in user: ${user.name} (ID: ${user.id}). Viewing as user: ${currentlyViewedUserId}`
    );
    log("info", `[DATA] Cycles received: ${cycles.length}`);
    log("info", `[DATA] Analytics received:`, analytics);

    if (user.show_instructions) {
      const overlay = document.getElementById("instructional-overlay");
      if (overlay) {
        log("info", "User preference set to show instructions. Activating overlay.");
        overlay.classList.add("active");
        renderInstruction();
      }
    }

    if (user.is_admin) {
      const appMenuContent = document.getElementById("app-menu-content");
      if (appMenuContent && !appMenuContent.querySelector(".admin-link")) {
        const adminLink = document.createElement("a");
        adminLink.href = "/admin";
        adminLink.textContent = "Admin";
        adminLink.className = "admin-link";
        appMenuContent.prepend(adminLink);
      }
    }

    log("info", "About to fetch shared users.");
    const sharedUsersRes = await fetch("/api/shared-users");
    const sharedUsers = await sharedUsersRes.json();
    log("info", "Received shared users data:", JSON.stringify(sharedUsers));

    // --- INTELLIGENT DEFAULT ---
    // If this is the initial load (no viewAsUserId), the current user has no cycles,
    // and there's another user available, default to the other user's view.
    if (!viewAsUserId && cycles.length === 0 && sharedUsers.length > 1) {
      const otherUser = sharedUsers.find((u) => u.id !== user.id);
      if (otherUser) {
        log(
          "info",
          `[AUTO-SWITCH] Current user has no data. Defaulting to view user ${otherUser.id}.`
        );
        fetchAndRenderData(elements, otherUser.id);
        return; // Stop the current render pass
      }
    }

    // Pass the currently viewed user's ID to the switcher to maintain state
    renderAccountSwitcher(sharedUsers, elements, user, viewAsUserId);

    renderCycles(cycles, elements, calculateFertileWindows(cycles));
    renderAnalytics(analytics, cycles, elements);
    renderLunarPulse(analytics, cycles);
  } catch (error) {
    log("error", "Error fetching data:", error);
  }
}

function renderCycles(cycles, elements, fertileWindows = []) {
  log("info", `[RENDER] --- renderCycles START ---. Received ${cycles.length} cycles.`);
  const container = elements.cyclesContainer;
  if (!container) {
    log("error", "[RENDER] Cycles container not found in DOM.");
    return;
  }
  container.innerHTML = ""; // Clear previous cycles

  if (!cycles || cycles.length === 0) {
    log("info", "[RENDER] No cycles to display. Showing message.");
    container.innerHTML =
      '<p>No cycles recorded yet. Start by logging your period start date.</p>';
    return;
  }

  const displayedCycles = cycles.slice(0, displayedCycleLimit);

  displayedCycles.forEach((cycle, index) => {
    log("info", `[RENDER] Processing cycle ${index + 1}/${cycles.length}, ID: ${cycle.id}`);
    const cycleDiv = document.createElement("div");
    cycleDiv.className = "cycle"; // Fix: Use .cycle to match CSS
    cycleDiv.dataset.cycleId = cycle.id;

    const startDate = new Date(cycle.start_date).toLocaleDateString(undefined, {
      timeZone: "UTC"
    });
    const endDate = cycle.end_date
      ? new Date(cycle.end_date).toLocaleDateString(undefined, { timeZone: "UTC" })
      : "Present";
    const cycleLength =
      cycle.end_date
        ? Math.round(
            (new Date(cycle.end_date) - new Date(cycle.start_date)) /
              (1000 * 60 * 60 * 24)
          ) +
          1
        : "Ongoing";

    cycleDiv.innerHTML = `
            <div class="cycle-header">
                <div class="cycle-title">
                    <h4>Cycle: ${startDate} - ${endDate}</h4>
                    <span>(${cycleLength} days)</span>
                </div>
                <div class="cycle-menu-container">
                    <button class="cycle-menu-button" data-cycle-id="${cycle.id}">
                        <span></span><span></span><span></span>
                    </button>
                    <div class="cycle-menu-content">
                        <a href="#" class="edit-cycle-btn" data-cycle-id="${cycle.id}">Edit</a>
                        <a href="#" class="delete-cycle-btn" data-id="${cycle.id}">Delete</a>
                    </div>
                </div>
            </div>
            <div class="day-grid"></div>
        `;

    const daysGrid = cycleDiv.querySelector(".day-grid");
    const menuButton = cycleDiv.querySelector(".cycle-menu-button");
    const menuContent = cycleDiv.querySelector(".cycle-menu-content");
    const editButton = cycleDiv.querySelector(".edit-cycle-btn");

    menuButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cycleDiv.classList.contains("edit-mode")) {
        toggleEditMode(cycleDiv, cycle.id, elements);
      } else {
        menuContent.classList.toggle("active");
      }
    });

    editButton.addEventListener("click", (e) => {
      e.preventDefault();
      toggleEditMode(cycleDiv, cycle.id, elements);
      menuContent.classList.remove("active"); // Close menu
    });
    const fertileWindow = fertileWindows.find((fw) => fw.cycleId === cycle.id);

    if (cycle.days) {
      cycle.days.forEach((day) => {
        const dayDiv = createDayDiv(day, cycle, fertileWindow, elements);
        daysGrid.appendChild(dayDiv);
      });
    }

    container.appendChild(cycleDiv);
  });

  // Add event listeners for the new delete buttons within menus
  container.querySelectorAll(".delete-cycle-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const cycleId = e.target.dataset.id;
      if (
        confirm(
          "Are you sure you want to delete this entire cycle? This action cannot be undone."
        )
      ) {
        deleteCycle(cycleId, elements);
      }
    });
  });

  if (cycles.length > displayedCycleLimit) {
    const showMoreBtn = document.createElement("button");
    showMoreBtn.className = "primary-btn";
    showMoreBtn.style.display = "block";
    showMoreBtn.style.margin = "20px auto";
    showMoreBtn.textContent = "Show More";
    showMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      displayedCycleLimit += 2;
      renderCycles(cycles, elements, fertileWindows);
    });
    container.appendChild(showMoreBtn);
  }

  log("info", `[RENDER] --- renderCycles END ---. Finished rendering cycles.`);
}

function calculateFertileWindows(cycles) {
  if (!cycles || cycles.length === 0) return [];

  // Calculate the historically established earliest Peak day across ALL cycles (up to last 6)
  // We'll calculate it once and apply it to each cycle relative to its own history if needed, 
  // but usually it applies broadly or building up to the current. 
  // To be safe and simple: find the historic earliest peak day index across the 6 most recent cycles.
  const recentCyclesForPeak = cycles.slice(0, 6); // Assuming cycles are sorted newest first
  let earliestPeakDayIndex = Infinity;

  recentCyclesForPeak.forEach(c => {
    if (!c.days) return;
    const peakDay = c.days.find(d => d.hormone_reading === 'Peak');
    if (peakDay) {
      const cStartStr = c.start_date.split('T')[0];
      const pDateStr = peakDay.date.split('T')[0];
      
      const startObj = new Date(cStartStr + 'T00:00:00');
      const peakObj = new Date(pDateStr + 'T00:00:00');
      
      const dayIndex = Math.round((peakObj - startObj) / (1000 * 60 * 60 * 24)) + 1;
      log("debug", `[FERTILE_WIN] Historic cycle ${c.id}: Peak on day index ${dayIndex}`);
      if (dayIndex < earliestPeakDayIndex) earliestPeakDayIndex = dayIndex;
    }
  });

  if (earliestPeakDayIndex === Infinity) {
    earliestPeakDayIndex = null; // No historic peaks
  }

  return cycles.map((cycle, index) => {
    const sortedDays = (cycle.days || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));

    const firstHighOrPeak = sortedDays.find(
      (d) => d.hormone_reading === "High" || d.hormone_reading === "Peak"
    );
    const lastPeak = sortedDays
      .slice()
      .reverse()
      .find((d) => d.hormone_reading === "Peak");

    const cycleStartDateStr = cycle.start_date.split('T')[0]; // Safe YYYY-MM-DD
    const cycleStartObj = new Date(cycleStartDateStr + 'T00:00:00'); // Clean local boundary

    let fertileStart = null;

    // 1. Start window 6 days prior to historically established earliest Peak day
    if (earliestPeakDayIndex !== null && earliestPeakDayIndex > 6) {
      const calculatedStartObj = new Date(cycleStartObj);
      calculatedStartObj.setDate(calculatedStartObj.getDate() + (earliestPeakDayIndex - 1) - 6);
      
      const year = calculatedStartObj.getFullYear();
      const month = String(calculatedStartObj.getMonth() + 1).padStart(2, '0');
      const day = String(calculatedStartObj.getDate()).padStart(2, '0');
      fertileStart = `${year}-${month}-${day}`;
      
    } else if (earliestPeakDayIndex !== null && earliestPeakDayIndex <= 6) {
      // If the peak is super early, window opens on day 1
      fertileStart = cycleStartDateStr;
    }

    // 2. OR immediately if a "High" or "Peak" is manually logged before that calculated date.
    if (firstHighOrPeak) {
      const loggedHighPeakDateStr = firstHighOrPeak.date.split("T")[0];
      if (!fertileStart || new Date(loggedHighPeakDateStr) < new Date(fertileStart)) {
        fertileStart = loggedHighPeakDateStr;
      }
    }

    let fertileEnd = null;
    // Window closes EXACTLY 3 full days after the last recorded "Peak" day.
    if (lastPeak) {
      const pDateStr = lastPeak.date.split('T')[0];
      const endDateObj = new Date(pDateStr + 'T00:00:00');
      endDateObj.setDate(endDateObj.getDate() + 3); // 3 full days after Peak
      
      const year = endDateObj.getFullYear();
      const month = String(endDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(endDateObj.getDate()).padStart(2, '0');
      fertileEnd = `${year}-${month}-${day}`;
    }

    return { cycleId: cycle.id, start: fertileStart, end: fertileEnd };
  });
}

function renderAccountSwitcher(users, elements, currentUser, currentlySelectedId) {
  log("info", `[RENDER] --- renderAccountSwitcher START ---`);
  log(
    "info",
    `[RENDER] Switcher Data: Total Users=${users.length}, Current User ID=${currentUser.id}, Selected User ID=${currentlySelectedId}`
  );

  const container = document.getElementById("account-switcher-container");
  if (!container) {
    log("error", "[RENDER] Account switcher container not found in DOM.");
    return;
  }
  container.innerHTML = "";
  container.style.display = "block";

  // Only show the switcher if there's more than one user (the current user + at least one partner)
  if (!users || users.length <= 1) {
    log("info", "[RENDER] No other shared users to display. Hiding switcher.");
    container.style.display = "none";
    return;
  }

  log("info", "[RENDER] Building account switcher dropdown...");
  const select = document.createElement("select");
  select.id = "user-switcher";

  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    // Label the current user as "My Data" for clarity
    option.textContent =
      user.id === currentUser.id ? "My Data" : user.name || user.email;

    // Determine which option should be selected
    const isCurrentlySelected =
      currentlySelectedId
        ? user.id == currentlySelectedId
        : user.id === currentUser.id;
    log("info", `[RENDER] Option: ${user.name}, isSelected: ${isCurrentlySelected}`);
    if (isCurrentlySelected) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  select.addEventListener("change", (e) => {
    const selectedUserId = e.target.value;
    log("info", `[ACTION] Dropdown changed. Selected User ID: ${selectedUserId}`);
    // If the selected ID matches the current user's ID, fetch with null to view self
    const viewAsId = selectedUserId == currentUser.id ? null : selectedUserId;
    displayedCycleLimit = 2; // Reset pagination
    fetchAndRenderData(elements, viewAsId);
  });

  container.appendChild(select);
  log("info", "Dropdown appended to container. --- renderAccountSwitcher END ---");
}

function renderAnalytics(analytics, cycles, elements) {
  const avgCycleLengthSpan = document.getElementById("avg-cycle-length");
  const cycleVariationSpan = document.getElementById("cycle-variation");
  const avgDaysToPeakSpan = document.getElementById("avg-days-to-peak");
  const avgLutealLengthSpan = document.getElementById("avg-luteal-length");
  const avgFertileWindowSpan = document.getElementById("avg-fertile-window");
  const estimatedNextPeriodSpan = document.getElementById("estimated-next-period");
  const estimatedNextPeakSpan = document.getElementById("estimated-next-peak");
  const fertileWindowStartSpan = document.getElementById("fertile-window-start");
  const fertileWindowEndSpan = document.getElementById("fertile-window-end");

  // Use backend-calculated averages
  avgCycleLengthSpan.textContent = analytics.averageCycleLength || "--";
  cycleVariationSpan.textContent = analytics.cycleVariation !== undefined ? analytics.cycleVariation : "--";
  avgDaysToPeakSpan.textContent = analytics.averageDaysToPeak || "--";
  avgLutealLengthSpan.textContent = analytics.averageLutealLength || "--";

  const fertileWindows = calculateFertileWindows(cycles);
  const validWindows = fertileWindows.filter((fw) => fw.start && fw.end);

  let avgFertileWindowLength = 0;
  if (validWindows.length > 0) {
    const totalFertileDays = validWindows.reduce((acc, fw) => {
      const start = new Date(fw.start);
      const end = new Date(fw.end);
      return acc + (end - start) / (1000 * 60 * 60 * 24) + 1;
    }, 0);
    avgFertileWindowLength = Math.round(totalFertileDays / validWindows.length);
    avgFertileWindowSpan.textContent = avgFertileWindowLength;
  } else {
    avgFertileWindowSpan.textContent = "--";
  }

  const mostRecentCycle = cycles && cycles.length > 0 ? cycles[0] : null;
  if (mostRecentCycle && analytics.averageCycleLength > 0) {
    const lastStartDate = new Date(mostRecentCycle.start_date);
    const nextPeriodDate = new Date(lastStartDate.getTime());
    nextPeriodDate.setDate(
      lastStartDate.getDate() + analytics.averageCycleLength
    );
    estimatedNextPeriodSpan.textContent = nextPeriodDate.toLocaleDateString();

    if (analytics.averageDaysToPeak > 0) {
      // Logic for Next Peak Estimation
      const hasPeakedThisCycle = mostRecentCycle.days && mostRecentCycle.days.some(d => d.hormone_reading === 'Peak');
      let nextPeakDate;
      
      if (!hasPeakedThisCycle && !mostRecentCycle.end_date) {
        // If they haven't peaked in the active ongoing cycle, predict it for this current cycle
        nextPeakDate = new Date(lastStartDate.getTime());
        nextPeakDate.setDate(lastStartDate.getDate() + analytics.averageDaysToPeak - 1);
      } else {
        // If they already peaked, or the cycle is closed, predict it for the upcoming cycle
        nextPeakDate = new Date(nextPeriodDate.getTime());
        nextPeakDate.setDate(nextPeriodDate.getDate() + analytics.averageDaysToPeak - 1);
      }
      
      estimatedNextPeakSpan.textContent = nextPeakDate.toLocaleDateString();

      // Ensure Fertile Window logic follows correctly
      if (avgFertileWindowLength > 0) {
        const nextFertileStartDate = new Date(nextPeriodDate.getTime());
        nextFertileStartDate.setDate(
          nextPeriodDate.getDate() +
            analytics.averageDaysToPeak -
            avgFertileWindowLength / 2
        );

        const nextFertileEndDate = new Date(nextFertileStartDate.getTime());
        nextFertileEndDate.setDate(
          nextFertileStartDate.getDate() + avgFertileWindowLength
        );

        fertileWindowStartSpan.textContent = nextFertileStartDate.toLocaleDateString();
        fertileWindowEndSpan.textContent = nextFertileEndDate.toLocaleDateString();
      } else {
        fertileWindowStartSpan.textContent = "--";
        fertileWindowEndSpan.textContent = "--";
      }
    } else {
      estimatedNextPeakSpan.textContent = "--";
      fertileWindowStartSpan.textContent = "--";
      fertileWindowEndSpan.textContent = "--";
    }
  } else {
    estimatedNextPeriodSpan.textContent = "--";
    fertileWindowStartSpan.textContent = "--";
    fertileWindowEndSpan.textContent = "--";
  }
}

function createDayDiv(dayData, cycle, fertileWindow, elements) {
  const dayDiv = document.createElement("div");
  dayDiv.className = "day";
  dayDiv.dataset.dayId = dayData.id;
  dayDiv.dataset.date = dayData.date;

  const dayDate = new Date(dayData.date);
  const cycleStartDate = new Date(cycle.start_date);

  // Calculate day number safely
  const dayNumber =
    dayDate && cycleStartDate
      ? Math.round((dayDate - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1
      : "N/A";
  const isPeriodDay = dayNumber >= 1 && dayNumber <= 5;

  // Apply fertile window shading
  if (fertileWindow && fertileWindow.start) {
    const startDate = new Date(fertileWindow.start);
    const endDate = fertileWindow.end ? new Date(fertileWindow.end) : null;
    if (dayDate >= startDate && (!endDate || dayDate <= endDate)) {
      dayDiv.classList.add("fertile-window");
    }
  }

  const reading = dayData.hormone_reading || "--";
  const readingClass = dayData.hormone_reading || "";

  dayDiv.innerHTML = `
        <button class="delete-day" data-id="${dayData.id}" style="display: ${!dayData.hormone_reading ? "none" : ""}; visibility: ${isPeriodDay ? "hidden" : "visible"}">&times;</button>
        <div class="day-number">Day ${dayNumber}</div>
        <div class="day-date">${dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}</div>
        <div class="reading ${readingClass}">${reading}</div>
        <div class="reading-edit">
            <select class="reading-select" ${isPeriodDay ? "disabled" : ""}>
                <option value="">--</option>
                <option value="Low" ${dayData.hormone_reading === "Low" ? "selected" : ""}>Low</option>
                <option value="High" ${dayData.hormone_reading === "High" ? "selected" : ""}>High</option>
                <option value="Peak" ${dayData.hormone_reading === "Peak" ? "selected" : ""}>Peak</option>
            </select>
            <div class="intercourse-edit">
                <input type="checkbox" class="intercourse-checkbox" ${dayData.intercourse ? "checked" : ""} ${isPeriodDay ? "disabled" : ""}> 
                ${isPeriodDay ? 
    "<img src=\"/bloodDrop.png\" class=\"blood-drop-icon\" alt=\"Period\"/>"
     : "❤️"}
            </div>
        </div>
        <div class="intercourse-display">
            ${isPeriodDay ? 
    "<img src=\"/bloodDrop.png\" class=\"blood-drop-icon\" alt=\"Period\"/>"
     : dayData.intercourse ? "❤️" : ""}
        </div>
    `;

  if (!isPeriodDay) {
    dayDiv.querySelector(".delete-day").addEventListener("click", (e) => {
      e.stopPropagation();
      dayDiv.classList.toggle("to-delete");
    });

    dayDiv.querySelector(".reading-select").addEventListener("change", (e) => {
      e.stopPropagation();
      dayDiv.dataset.modifiedReading = e.target.value;
      dayDiv.classList.add("modified");
    });

    dayDiv.querySelector(".intercourse-checkbox").addEventListener("change", (e) => {
      e.stopPropagation();
      dayDiv.dataset.modifiedIntercourse = e.target.checked;
      dayDiv.classList.add("modified");
    });
  }

  return dayDiv;
}

async function logOrUpdateReading(payload, elements) {
  const { id, date, hormone_reading, intercourse, cycle_id, userId } = payload;

  const isUpdate = id !== undefined;
  const url = isUpdate ? `/api/cycles/days/${id}` : "/api/cycles/days";
  const method = isUpdate ? "PUT" : "POST";

  const body = { date, cycle_id, userId };
  if (hormone_reading !== undefined) body.hormone_reading = hormone_reading;
  if (intercourse !== undefined) body.intercourse = intercourse;

  try {
    const response = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errorMsg = "Failed to save reading.";
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        // If the response is not JSON, use its text content
        const textError = await response.text();
        errorMsg = textError || errorMsg;
      }
      log(
        "error",
        `[API_CALL] Failed to save reading. Server responded with ${response.status}. Message: ${errorMsg}`
      );
      throw new Error(errorMsg);
    }

    log("info", "[API_CALL] Save successful. Refreshing data.");
    fetchAndRenderData(elements, currentlyViewedUserId); // Refresh data
  } catch (error) {
    console.error("Error saving reading:", error);
  }
}

function toggleEditMode(cycleDiv, cycleId, elements) {
  cycleDiv.classList.toggle("edit-mode");
  const isEditing = cycleDiv.classList.contains("edit-mode");

  // Also ensure the menu content is hidden when toggling edit mode
  const menuContent = cycleDiv.querySelector(".cycle-menu-content");
  if (menuContent) {
    menuContent.classList.remove("active");
  }

  const dayElements = cycleDiv.querySelectorAll(".day");

  if (!isEditing) {
    // We are exiting edit mode. Check for pending deletions.
    const deletedDays = Array.from(dayElements).filter(d => d.classList.contains("to-delete"));
    if (deletedDays.length > 0) {
      if (confirm(`Are you sure you want to delete ${deletedDays.length} reading(s)?`)) {
        const deletePromises = deletedDays.map(dayDiv => {
          const id = dayDiv.dataset.dayId;
          return fetch(`/api/cycles/days/${id}`, { method: "DELETE" });
        });
        
        Promise.all(deletePromises)
          .then(() => {
            log("info", `Successfully bulk-deleted ${deletedDays.length} readings.`);
            fetchAndRenderData(elements, currentlyViewedUserId);
          })
          .catch(error => {
            console.error("Error bulk deleting readings:", error);
            alert("An error occurred while deleting one or more readings.");
            fetchAndRenderData(elements, currentlyViewedUserId);
          });
        return; // Early return to let fetchAndRenderData handle UI reset
      } else {
        // User cancelled. Untoggle the classes.
        deletedDays.forEach(d => d.classList.remove("to-delete"));
      }
    } else {
      // Check for modified days to bulk-save
      const modifiedDays = Array.from(dayElements).filter(d => d.classList.contains("modified") && !d.classList.contains("to-delete"));
      if (modifiedDays.length > 0) {
        log("info", "Detected modified days, bulk updating...");
        const updatePromises = modifiedDays.map(dayDiv => {
          const id = dayDiv.dataset.dayId;
          const originalReading = dayDiv.dataset.originalReading === "" ? null : dayDiv.dataset.originalReading;
          const originalIntercourse = dayDiv.dataset.originalIntercourse === "true";
          let newReading = dayDiv.dataset.modifiedReading !== undefined ? dayDiv.dataset.modifiedReading : originalReading;
          let newIntercourse = dayDiv.dataset.modifiedIntercourse !== undefined ? dayDiv.dataset.modifiedIntercourse === "true" : originalIntercourse;
          
          if (newReading === "") newReading = null;

          return fetch(`/api/cycles/days/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hormone_reading: newReading, intercourse: newIntercourse }),
          });
        });

        Promise.all(updatePromises)
          .then(() => {
            log("info", "Successfully bulk updated readings.");
            fetchAndRenderData(elements, currentlyViewedUserId);
          })
          .catch(error => {
            console.error("Error bulk updating readings:", error);
            alert("An error occurred while updating readings.");
            fetchAndRenderData(elements, currentlyViewedUserId);
          });
        return; // Early return to let fetchAndRenderData handle UI reset
      }
      // No edits or deletions, just continue
    }
  }

  dayElements.forEach((day) => {
    const display = day.querySelector(".reading");
    const edit = day.querySelector(".reading-edit");
    const intercourseDisplay = day.querySelector(".intercourse-display");

    if (display) display.style.display = isEditing ? "none" : "block";
    if (edit) edit.style.display = isEditing ? "block" : "none";
    if (intercourseDisplay) intercourseDisplay.style.display = isEditing ? "none" : "block";
  });
}

async function handleReadingSubmit(e, elements) {
  e.preventDefault();
  log("info", '[ADD_READING] "Log Reading" form submitted.');
  const rangeCheckbox = document.getElementById("range-checkbox");
  const startDate = document.getElementById("date").value;
  const endDate = document.getElementById("end-date").value;
  const hormone_reading = document.getElementById("reading").value;
  const intercourse = document.getElementById("intercourse-checkbox").checked;

  if (!startDate) {
    alert("Please select a start date.");
    return;
  }

  // If the range checkbox is checked, call the range endpoint
  if (rangeCheckbox.checked) {
    if (!endDate) {
      alert("Please select an end date for the range.");
      return;
    }

    const payload = {
      start_date: startDate,
      end_date: endDate,
      hormone_reading: hormone_reading || null,
      intercourse,
      userId: currentlyViewedUserId
    };

    try {
      const response = await fetch("/api/cycles/days/range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to log range.");
      }
      fetchAndRenderData(elements, currentlyViewedUserId); // Refresh data
    } catch (error) {
      console.error("Error from range submit:", error);
      alert(error.message);
    }
  } else {
    // Otherwise, use the existing single-day logic
    const payload = {
      date: startDate,
      hormone_reading: hormone_reading || null,
      intercourse,
      userId: currentlyViewedUserId
    };

    try {
      // Hardware Automation: PPHLL Sequence Check
      if (hormone_reading === "Peak") {
        log("info", "[AUTOMATION] Peak detected! Automating PPHLL sequence...");
        
        // 1. Submit the initial actual Peak Day
        await fetch("/api/cycles/days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        // 2. Submit the automated future days
        const sequence = ['Peak', 'High', 'Low', 'Low'];
        const autoPromises = sequence.map((reading, index) => {
          const nextDate = new Date(startDate);
          nextDate.setDate(nextDate.getDate() + (index + 1));
          return fetch("/api/cycles/days", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: nextDate.toISOString().split("T")[0],
              hormone_reading: reading,
              intercourse: false, // Default false for future prediction
              userId: currentlyViewedUserId
            })
          });
        });
        
        await Promise.all(autoPromises);
        log("info", "[AUTOMATION] PPHLL Sequence successfully injected.");
        
        // Render UI once at the very end
        fetchAndRenderData(elements, currentlyViewedUserId);

      } else {
        // Normal single day submission 
        await logOrUpdateReading(payload, elements);
      }
    } catch (error) {
      console.error("Error from single day submit:", error);
      alert(error.message);
    }
  }
}

async function handleNewCycleSubmit(elements) {
  // Prevent any default form submission if wrapped in a form
  const event = window.event;
  if (event && event.preventDefault) {
      event.preventDefault();
  }

  const startDateInput = document.getElementById("period-start-date");
  const start_date = startDateInput.value;

  if (!start_date) {
    alert("Please select a start date for the new cycle.");
    return;
  }

  try {
    const response = await fetch("/api/cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date, userId: currentlyViewedUserId })
    });

    if (!response.ok) {
      let errorMsg = "Failed to start new cycle.";
      try {
        const errorData = await response.json();
        errorMsg = errorData.error || errorMsg;
      } catch (e) {
        const textError = await response.text();
        errorMsg = textError || errorMsg;
      }
      throw new Error(errorMsg);
    }

    log("info", "[NEW_CYCLE] Successfully started new cycle. Refreshing data...");
    startDateInput.value = new Date().toISOString().split("T")[0]; // Reset input
    fetchAndRenderData(elements, currentlyViewedUserId); // Refresh the UI, preserving the view
  } catch (error) {
    console.error("Error starting new cycle:", error);
    alert(error.message);
  }
}

async function deleteCycle(id, elements) {
  log("info", `[DELETE_CYCLE] Attempting to delete cycle ID: ${id}`);
  try {
    const response = await fetch(`/api/cycles/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete cycle.");
    }

    log("info", `Successfully deleted cycle ${id}. Refreshing data...`);
    fetchAndRenderData(elements, currentlyViewedUserId); // Refresh the UI, preserving the view
  } catch (error) {
    console.error("Error deleting cycle:", error);
    alert(error.message);
  }
}

async function deleteReading(id, elements) {
  if (!id) return; // Ignore if there's no ID (for unsaved days)
  log("info", `[DELETE_DAY] Attempting to delete day reading ID: ${id}`);
  try {
    const response = await fetch(`/api/cycles/days/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to delete reading");
    fetchAndRenderData(elements); // Refresh data
  } catch (error) {
    console.error("Error deleting reading:", error);
  }
}

function initializeInfoButtons() {
    const buttons = document.querySelectorAll('.card-info-btn');
    const overlay = document.getElementById('info-modal-overlay');
    if (!overlay) return;
    
    const titleEl = document.getElementById('info-title');
    const contentEl = document.getElementById('info-content');
    const closeBtn = document.getElementById('close-info-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const key = btn.getAttribute('data-info');
            const data = infoData[key];
            if (data) {
                titleEl.textContent = data.title;
                contentEl.innerHTML = data.content;
                overlay.classList.add('active');
            }
        });
    });

    const closeOverlay = () => overlay.classList.remove('active');
    
    closeBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });
}

async function handleShareSubmit(e) {
  // ... function implementation
}
