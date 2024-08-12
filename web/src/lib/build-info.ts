const date = new Date();
const formattedDate = date.toLocaleDateString('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

const formattedTime = date.toLocaleTimeString('de-DE', {
  hour: '2-digit',
  minute: '2-digit'
});

// build date is dd.mm.yyyy HH:MM
export const buildDate = `${formattedDate} ${formattedTime}`;