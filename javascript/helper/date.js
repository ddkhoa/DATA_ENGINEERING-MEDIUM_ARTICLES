
function generateDateRange(start, end) {
    let dateArr = []
    let date = start
    while (date <= end) {
        dateArr.push(new Date(date));
        date.setDate(date.getDate() + 1)
    }

    return dateArr;
}

function formatDate(date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const dateInMonth = date.getDate()
    const monthPadded = month.toString().padStart(2, '0')
    const dateInMonthPadded = dateInMonth.toString().padStart(2, '0')

    return `${dateInMonthPadded}/${monthPadded}/${year}`
}

module.exports = {
    generateDateRange,
    formatDate
}