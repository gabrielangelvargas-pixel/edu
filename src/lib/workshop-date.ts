const workshopDate = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function getWorkshopDateLabel() {
  return workshopDate.format(new Date());
}

export function getWorkshopDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}
