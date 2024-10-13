export const formatDate: (date: Date) => string = (date: Date) => {
  return `${date.getFullYear()}-${("00" + (date.getMonth() + 1)).slice(-2)}-${("00" + date.getDate()).slice(-2)}`;
};
