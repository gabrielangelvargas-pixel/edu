const timeZone = "America/Argentina/Buenos_Aires";

const workshopDate = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone,
});

const workshopTimestamp = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone,
});

export function getWorkshopDateLabel() {
  return workshopDate.format(new Date());
}

export function getWorkshopTimestamp() {
  return workshopTimestamp.format(new Date());
}

export function getWorkshopDate() {
  return getWorkshopTimestamp().slice(0, 10);
}
