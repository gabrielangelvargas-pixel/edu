const workshopDate = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function getWorkshopDateLabel() {
  return workshopDate.format(new Date());
}
