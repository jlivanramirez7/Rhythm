const webpush = require('web-push');
const moment = require('moment-timezone');
const { sql } = require('./utils');

let cachedVapidKeys = null;

const DEFAULT_PREFERENCES = {
    notify_menstrual: true,
    notify_follicular: true,
    notify_ovulatory: true,
    notify_peak: true,
    notify_luteal: true,
    last_notified_phase: null
};

const PHASE_METADATA = {
    menstrual: {
        key: 'menstrual',
        prefField: 'notify_menstrual',
        label: 'Menstrual Phase',
        title: 'Entering Menstrual Phase 🩸',
        getBody: (day) => `Cycle Day ${day}: A new cycle has started. No monitor testing needed during Days 1–5.`
    },
    follicular: {
        key: 'follicular',
        prefField: 'notify_follicular',
        label: 'Follicular Phase',
        title: 'Entering Follicular Phase 🌱',
        getBody: (day) => `Cycle Day ${day}: Period phase complete. Begin daily morning hormone testing today.`
    },
    ovulatory: {
        key: 'ovulatory',
        prefField: 'notify_ovulatory',
        label: 'Ovulatory (Fertile Window)',
        title: 'Entering Ovulatory Phase 🌸',
        getBody: (day) => `Cycle Day ${day}: Your fertile window is now OPEN under the Marquette Method.`
    },
    peak: {
        key: 'peak',
        prefField: 'notify_peak',
        label: 'Peak Fertility (LH Surge)',
        title: 'Peak Fertility Detected 🌟',
        getBody: (day) => `Cycle Day ${day}: LH surge logged. Ovulation is imminent — the PPHLL countdown has begun.`
    },
    luteal: {
        key: 'luteal',
        prefField: 'notify_luteal',
        label: 'Luteal Phase',
        title: 'Entering Luteal Phase 🌙',
        getBody: (day) => `Cycle Day ${day}: Your fertile window is officially closed. You are now in the post-ovulatory Luteal phase.`
    }
};

/**
 * Retrieves or generates persistent VAPID keys for Web Push.
 */
async function getOrCreateVapidKeys(db) {
    if (cachedVapidKeys) {
        return cachedVapidKeys;
    }

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        cachedVapidKeys = {
            publicKey: process.env.VAPID_PUBLIC_KEY,
            privateKey: process.env.VAPID_PRIVATE_KEY
        };
        webpush.setVapidDetails(
            'mailto:admin@rhythm-app.com',
            cachedVapidKeys.publicKey,
            cachedVapidKeys.privateKey
        );
        return cachedVapidKeys;
    }

    const isPostgres = db.adapter === 'postgres';
    try {
        const row = await db.get(
            sql(`SELECT value FROM app_config WHERE key = ?`, isPostgres),
            ['vapid_keys']
        );
        if (row && row.value) {
            cachedVapidKeys = JSON.parse(row.value);
            webpush.setVapidDetails(
                'mailto:admin@rhythm-app.com',
                cachedVapidKeys.publicKey,
                cachedVapidKeys.privateKey
            );
            return cachedVapidKeys;
        }
    } catch (err) {
        console.warn('[NOTIFICATIONS] Could not read vapid_keys from app_config:', err.message);
    }

    const generated = webpush.generateVAPIDKeys();
    cachedVapidKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey
    };

    try {
        const existing = await db.get(
            sql(`SELECT key FROM app_config WHERE key = ?`, isPostgres),
            ['vapid_keys']
        );
        if (existing) {
            await db.run(
                sql(`UPDATE app_config SET value = ? WHERE key = ?`, isPostgres),
                [JSON.stringify(cachedVapidKeys), 'vapid_keys']
            );
        } else {
            await db.run(
                sql(`INSERT INTO app_config (key, value) VALUES (?, ?)`, isPostgres),
                ['vapid_keys', JSON.stringify(cachedVapidKeys)]
            );
        }
    } catch (err) {
        console.warn('[NOTIFICATIONS] Could not persist vapid_keys to app_config:', err.message);
    }

    webpush.setVapidDetails(
        'mailto:admin@rhythm-app.com',
        cachedVapidKeys.publicKey,
        cachedVapidKeys.privateKey
    );
    return cachedVapidKeys;
}

/**
 * Normalizes boolean fields across SQLite (0/1) and Postgres (true/false).
 */
function normalizePrefs(row) {
    if (!row) {
        return { ...DEFAULT_PREFERENCES };
    }
    return {
        notify_menstrual: Boolean(row.notify_menstrual),
        notify_follicular: Boolean(row.notify_follicular),
        notify_ovulatory: Boolean(row.notify_ovulatory),
        notify_peak: Boolean(row.notify_peak),
        notify_luteal: Boolean(row.notify_luteal),
        last_notified_phase: row.last_notified_phase || null
    };
}

/**
 * Fetches notification preferences and active subscription count for a user.
 */
async function getUserNotificationPreferences(db, userId) {
    const isPostgres = db.adapter === 'postgres';
    const row = await db.get(
        sql(`SELECT * FROM notification_preferences WHERE user_id = ?`, isPostgres),
        [userId]
    );
    const subs = await db.query(
        sql(`SELECT id, endpoint FROM push_subscriptions WHERE user_id = ?`, isPostgres),
        [userId]
    );
    const prefs = normalizePrefs(row);
    return {
        ...prefs,
        subscriptionsCount: Array.isArray(subs) ? subs.length : 0
    };
}

/**
 * Saves a user's phase-transition notification toggles to the database.
 */
async function saveUserNotificationPreferences(db, userId, prefs) {
    const isPostgres = db.adapter === 'postgres';
    const existing = await db.get(
        sql(`SELECT user_id, last_notified_phase FROM notification_preferences WHERE user_id = ?`, isPostgres),
        [userId]
    );

    const toDbBool = (val, fallback = true) => {
        const b = val !== undefined ? Boolean(val) : fallback;
        return isPostgres ? b : (b ? 1 : 0);
    };

    const menstrual = toDbBool(prefs.notify_menstrual, true);
    const follicular = toDbBool(prefs.notify_follicular, true);
    const ovulatory = toDbBool(prefs.notify_ovulatory, true);
    const peak = toDbBool(prefs.notify_peak, true);
    const luteal = toDbBool(prefs.notify_luteal, true);
    const nowIso = new Date().toISOString();

    if (existing) {
        await db.run(
            sql(
                `UPDATE notification_preferences 
                 SET notify_menstrual = ?, notify_follicular = ?, notify_ovulatory = ?, notify_peak = ?, notify_luteal = ?, updated_at = ?
                 WHERE user_id = ?`,
                isPostgres
            ),
            [menstrual, follicular, ovulatory, peak, luteal, nowIso, userId]
        );
    } else {
        await db.run(
            sql(
                `INSERT INTO notification_preferences 
                 (user_id, notify_menstrual, notify_follicular, notify_ovulatory, notify_peak, notify_luteal, last_notified_phase, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                isPostgres
            ),
            [userId, menstrual, follicular, ovulatory, peak, luteal, null, nowIso]
        );
    }

    return getUserNotificationPreferences(db, userId);
}

/**
 * Updates only the last_notified_phase token for a user.
 */
async function updateLastNotifiedPhase(db, userId, phaseToken) {
    const isPostgres = db.adapter === 'postgres';
    const existing = await db.get(
        sql(`SELECT user_id FROM notification_preferences WHERE user_id = ?`, isPostgres),
        [userId]
    );
    const nowIso = new Date().toISOString();

    if (existing) {
        await db.run(
            sql(`UPDATE notification_preferences SET last_notified_phase = ?, updated_at = ? WHERE user_id = ?`, isPostgres),
            [phaseToken, nowIso, userId]
        );
    } else {
        const defaultBool = isPostgres ? true : 1;
        await db.run(
            sql(
                `INSERT INTO notification_preferences 
                 (user_id, notify_menstrual, notify_follicular, notify_ovulatory, notify_peak, notify_luteal, last_notified_phase, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                isPostgres
            ),
            [userId, defaultBool, defaultBool, defaultBool, defaultBool, defaultBool, phaseToken, nowIso]
        );
    }
}

/**
 * Saves a Web Push subscription for a user.
 */
async function savePushSubscription(db, userId, subscription) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        throw new Error('Invalid push subscription payload');
    }
    const isPostgres = db.adapter === 'postgres';
    const { endpoint, keys } = subscription;
    const p256dh = keys.p256dh || '';
    const auth = keys.auth || '';
    const nowIso = new Date().toISOString();

    const existing = await db.get(
        sql(`SELECT id FROM push_subscriptions WHERE endpoint = ?`, isPostgres),
        [endpoint]
    );

    if (existing) {
        await db.run(
            sql(`UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, created_at = ? WHERE id = ?`, isPostgres),
            [userId, p256dh, auth, nowIso, existing.id]
        );
    } else {
        await db.run(
            sql(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)`, isPostgres),
            [userId, endpoint, p256dh, auth, nowIso]
        );
    }
}

/**
 * Removes a Web Push subscription for a user.
 */
async function removePushSubscription(db, userId, endpoint) {
    const isPostgres = db.adapter === 'postgres';
    if (endpoint) {
        await db.run(
            sql(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, isPostgres),
            [userId, endpoint]
        );
    } else {
        await db.run(
            sql(`DELETE FROM push_subscriptions WHERE user_id = ?`, isPostgres),
            [userId]
        );
    }
}

/**
 * Computes the current phase of the active cycle for a given array of cycles (sorted newest first).
 * Strictly models phase transitions: menstrual -> follicular -> ovulatory -> peak -> luteal.
 */
function determineCurrentCyclePhase(cycles, referenceDateStr = null) {
    if (!Array.isArray(cycles) || cycles.length === 0) return null;

    const activeCycle = cycles[0];
    if (!activeCycle || activeCycle.end_date) return null;

    const todayStr = referenceDateStr || moment.utc().format('YYYY-MM-DD');
    const cycleStartStr = String(activeCycle.start_date).split('T')[0];

    const startMoment = moment.utc(cycleStartStr, 'YYYY-MM-DD');
    const todayMoment = moment.utc(todayStr, 'YYYY-MM-DD');
    const currentCycleDay = Math.max(1, todayMoment.diff(startMoment, 'days') + 1);

    // 1. Compute earliest historical Peak day index across all cycles
    let earliestPeakDayIndex = Infinity;
    cycles.forEach((c) => {
        if (!c.days) return;
        const sorted = c.days.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const peakDay = sorted.find((d) => d.hormone_reading === 'Peak');
        if (peakDay) {
            const cStart = moment.utc(String(c.start_date).split('T')[0], 'YYYY-MM-DD');
            const pDate = moment.utc(String(peakDay.date).split('T')[0], 'YYYY-MM-DD');
            const idx = pDate.diff(cStart, 'days') + 1;
            if (idx > 0 && idx < earliestPeakDayIndex) {
                earliestPeakDayIndex = idx;
            }
        }
    });
    if (earliestPeakDayIndex === Infinity) {
        earliestPeakDayIndex = null;
    }

    // 2. Analyze active cycle readings
    const sortedDays = (activeCycle.days || [])
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const firstHighOrPeak = sortedDays.find(
        (d) => d.hormone_reading === 'High' || d.hormone_reading === 'Peak'
    );
    const peakDays = sortedDays.filter((d) => d.hormone_reading === 'Peak');
    const firstPeak = peakDays.length > 0 ? peakDays[0] : null;
    const lastPeak = peakDays.length > 0 ? peakDays[peakDays.length - 1] : null;

    let fertileStart = null;
    if (earliestPeakDayIndex !== null && earliestPeakDayIndex > 6) {
        fertileStart = startMoment
            .clone()
            .add(earliestPeakDayIndex - 1 - 6, 'days')
            .format('YYYY-MM-DD');
    } else if (earliestPeakDayIndex !== null && earliestPeakDayIndex <= 6) {
        fertileStart = cycleStartStr;
    }

    if (firstHighOrPeak) {
        const loggedDateStr = String(firstHighOrPeak.date).split('T')[0];
        if (!fertileStart || loggedDateStr < fertileStart) {
            fertileStart = loggedDateStr;
        }
    }

    let fertileEnd = null;
    if (lastPeak) {
        const lastPeakStr = String(lastPeak.date).split('T')[0];
        fertileEnd = moment.utc(lastPeakStr, 'YYYY-MM-DD').add(3, 'days').format('YYYY-MM-DD');
    }

    // 3. Determine active phase key in strict cycle progression:
    // menstrual -> follicular -> ovulatory -> peak -> luteal
    let phaseKey = 'menstrual';
    const firstPeakStr = firstPeak ? String(firstPeak.date).split('T')[0] : null;

    if (fertileEnd && todayStr > fertileEnd) {
        phaseKey = 'luteal';
    } else if (firstPeakStr && (!fertileEnd || todayStr <= fertileEnd)) {
        phaseKey = 'peak';
    } else if ((fertileStart && todayStr >= fertileStart && (!fertileEnd || todayStr <= fertileEnd)) || firstHighOrPeak) {
        phaseKey = 'ovulatory';
    } else if (currentCycleDay <= 5) {
        phaseKey = 'menstrual';
    } else {
        phaseKey = 'follicular';
    }

    const meta = PHASE_METADATA[phaseKey];
    return {
        cycleId: activeCycle.id,
        phaseKey,
        prefField: meta.prefField,
        label: meta.label,
        currentCycleDay,
        stateToken: `${activeCycle.id}:${phaseKey}`,
        title: meta.title,
        body: meta.getBody(currentCycleDay)
    };
}

/**
 * Dispatches a push payload to all subscriptions for a user, cleaning up expired endpoints.
 */
async function sendPushToUserSubscriptions(db, userId, payload) {
    const isPostgres = db.adapter === 'postgres';
    await getOrCreateVapidKeys(db);

    const subs = await db.query(
        sql(`SELECT * FROM push_subscriptions WHERE user_id = ?`, isPostgres),
        [userId]
    );
    if (!subs || subs.length === 0) {
        return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const messageStr = JSON.stringify(payload);

    for (const sub of subs) {
        const pushSub = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        };
        try {
            await webpush.sendNotification(pushSub, messageStr);
            sent++;
        } catch (err) {
            failed++;
            if (err.statusCode === 404 || err.statusCode === 410) {
                await db.run(
                    sql(`DELETE FROM push_subscriptions WHERE id = ?`, isPostgres),
                    [sub.id]
                );
            } else {
                console.warn(`[NOTIFICATIONS] Failed to send push to sub ${sub.id}:`, err.message);
            }
        }
    }

    return { sent, failed };
}

/**
 * Checks whether the given cycle owner has entered a new cycle phase, and if so,
 * sends a notification ONLY for that phase transition to users who have that phase toggled ON.
 *
 * @param {object} db - Database wrapper.
 * @param {number} cycleOwnerUserId - The user whose cycles are being tracked.
 * @param {object} [options] - Optional { seedOnly: boolean } to baseline phase without firing push.
 */
async function checkAndSendPhaseNotifications(db, cycleOwnerUserId, options = {}) {
    const isPostgres = db.adapter === 'postgres';
    try {
        const cycles = await db.query(
            sql(`SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date DESC`, isPostgres),
            [cycleOwnerUserId]
        );
        if (!cycles || cycles.length === 0) return null;

        for (const c of cycles) {
            c.days = await db.query(
                sql(`SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY date ASC`, isPostgres),
                [c.id]
            );
        }

        const phaseInfo = determineCurrentCyclePhase(cycles);
        if (!phaseInfo) return null;

        // Find all users who view or own this cycle data (the owner + any partner linked to them)
        const interestedUsers = await db.query(
            sql(
                `SELECT id FROM users WHERE id = ? OR partner_id = ? OR default_view_user_id = ?`,
                isPostgres
            ),
            [cycleOwnerUserId, cycleOwnerUserId, cycleOwnerUserId]
        );

        for (const u of interestedUsers) {
            const prefs = await getUserNotificationPreferences(db, u.id);

            // If already notified for this exact cycle & phase, do nothing (no daily nagging!)
            if (prefs.last_notified_phase === phaseInfo.stateToken) {
                continue;
            }

            // Record the new phase transition in DB
            await updateLastNotifiedPhase(db, u.id, phaseInfo.stateToken);

            if (options.seedOnly) {
                continue;
            }

            // Only dispatch push if the user has this specific phase transition toggled ON
            const isPhaseEnabled = Boolean(prefs[phaseInfo.prefField]);
            if (isPhaseEnabled && prefs.subscriptionsCount > 0) {
                await sendPushToUserSubscriptions(db, u.id, {
                    title: phaseInfo.title,
                    body: phaseInfo.body,
                    tag: `rhythm-phase-${phaseInfo.stateToken}`,
                    url: '/app'
                });
            }
        }

        return phaseInfo;
    } catch (err) {
        console.error('[NOTIFICATIONS] Error in checkAndSendPhaseNotifications:', err);
        return null;
    }
}

module.exports = {
    PHASE_METADATA,
    getOrCreateVapidKeys,
    getUserNotificationPreferences,
    saveUserNotificationPreferences,
    savePushSubscription,
    removePushSubscription,
    determineCurrentCyclePhase,
    sendPushToUserSubscriptions,
    checkAndSendPhaseNotifications
};
