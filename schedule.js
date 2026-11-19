// Banner can return separate lecture, lab, and weekend meeting records for a single section.
const iroarSchedule = (() => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    function minutes(time) {
        if (!/^\d{4}$/.test(time)) return null;
        const hour = Number(time.slice(0, 2)), minute = Number(time.slice(2));
        if (hour === 24 && minute === 0) return 1440;
        return hour < 24 && minute < 60 ? hour * 60 + minute : null;
    }
    function dateKey(value) {
        const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
        if (us) return Number(us[3]) * 10000 + Number(us[1]) * 100 + Number(us[2]);
        const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        return iso ? Number(iso[1] + iso[2] + iso[3]) : null;
    }
    function build(sections) {
        const events = [];
        const unscheduled = [];
        for (const [index, section] of sections.entries()) {
            const label = [section.subject, section.courseNumber].filter(Boolean).join(' ');
            const seen = new Set();
            const meetings = section.meetingsFaculty || [];
            let hasTba = !meetings.length;
            for (const entry of meetings) {
                const m = entry.meetingTime || {};
                const start = minutes(m.beginTime), end = minutes(m.endTime);
                const active = days.filter(day => m[day]);
                if (start === null || end === null || end <= start || !active.length) { hasTba = true; continue; }
                for (const day of active) {
                    const first = dateKey(m.startDate), last = dateKey(m.endDate);
                    const key = [day,start,end,first,last].join('/');
                    if (seen.has(key)) continue;
                    seen.add(key);
                    events.push({index, label, day, start, end, first, last});
                }
            }
            if (hasTba) unscheduled.push(label);
        }
        const conflicts = new Set();
        for (const day of days) {
            const group = events.filter(e => e.day === day).sort((a,b) => a.start - b.start || b.end - a.end);
            // Share the column between blocks that occupy the same time on the weekly grid.
            let cluster = [], until = -1, laneEnds = [];
            function finishCluster() { for (const event of cluster) event.lanes = laneEnds.length; }
            for (const event of group) {
                if (event.start >= until) { finishCluster(); cluster = []; laneEnds = []; until = -1; }
                for (const other of cluster) {
                    if (other.index === event.index || other.end <= event.start ||
                        (other.last !== null && event.first !== null && other.last < event.first) ||
                        (event.last !== null && other.first !== null && event.last < other.first)) continue;
                    conflicts.add([other.index,event.index].sort((a,b) => a-b).join('/'));
                }
                const free = laneEnds.findIndex(end => end <= event.start);
                event.lane = free < 0 ? laneEnds.length : free;
                laneEnds[event.lane] = event.end;
                cluster.push(event);
                until = Math.max(until,event.end);
            }
            finishCluster();
        }
        return {events, unscheduled, conflicts: [...conflicts].map(pair => pair.split('/').map(Number))};
    }
    return {days, build};
})();
