import moment from "moment"

// Formats a run's ISO timestamp into a short, readable "Sep 13, 8:12 AM" —
// shared by RunsTable's "Updated" column and RunResultSheet's detail view so
// both stay in sync.
export const formatRunTimestamp = (isoDate: string) => moment(isoDate).fromNow()
