class StringUtilities {
    static format(template, ...values) {
        return template.replace(/%s/g, function () {
            return values.shift();
        });
    }
    static containsAny(text, searchStrings) {
        return searchStrings.some(c => {
            return text.indexOf(c) > -1;
        });
    }
}

class CronParser {
    constructor(expression, dayOfWeekStartIndexZero = true) {
        this.expression = expression;
        this.dayOfWeekStartIndexZero = dayOfWeekStartIndexZero;
    }
    parse() {
        let parsed = this.extractParts(this.expression);
        this.normalize(parsed);
        this.validate(parsed);
        return parsed;
    }
    extractParts(expression) {
        if (!this.expression) {
            throw new Error("Expression is empty");
        }
        let parsed = expression.trim().split(" ");
        if (parsed.length < 5) {
            throw new Error(`Expression has only ${parsed.length} part${parsed.length == 1 ? "" : "s"}. At least 5 parts are required.`);
        }
        else if (parsed.length == 5) {
            parsed.unshift("");
            parsed.push("");
        }
        else if (parsed.length == 6) {
            if (/\d{4}$/.test(parsed[5])) {
                parsed.unshift("");
            }
            else {
                parsed.push("");
            }
        }
        else if (parsed.length > 7) {
            throw new Error(`Expression has ${parsed.length} parts; too many!`);
        }
        return parsed;
    }
    normalize(expressionParts) {
        expressionParts[3] = expressionParts[3].replace("?", "*");
        expressionParts[5] = expressionParts[5].replace("?", "*");
        if (expressionParts[0].indexOf("0/") == 0) {
            expressionParts[0] = expressionParts[0].replace("0/", "*/");
        }
        if (expressionParts[1].indexOf("0/") == 0) {
            expressionParts[1] = expressionParts[1].replace("0/", "*/");
        }
        if (expressionParts[2].indexOf("0/") == 0) {
            expressionParts[2] = expressionParts[2].replace("0/", "*/");
        }
        if (expressionParts[3].indexOf("1/") == 0) {
            expressionParts[3] = expressionParts[3].replace("1/", "*/");
        }
        if (expressionParts[4].indexOf("1/") == 0) {
            expressionParts[4] = expressionParts[4].replace("1/", "*/");
        }
        if (expressionParts[5].indexOf("1/") == 0) {
            expressionParts[5] = expressionParts[5].replace("1/", "*/");
        }
        if (expressionParts[6].indexOf("1/") == 0) {
            expressionParts[6] = expressionParts[6].replace("1/", "*/");
        }
        expressionParts[5] = expressionParts[5].replace(/(^\d)|([^#/\s]\d)/g, t => {
            let dowDigits = t.replace(/\D/, "");
            let dowDigitsAdjusted = dowDigits;
            if (this.dayOfWeekStartIndexZero) {
                if (dowDigits == "7") {
                    dowDigitsAdjusted = "0";
                }
            }
            else {
                dowDigitsAdjusted = (parseInt(dowDigits) - 1).toString();
            }
            return t.replace(dowDigits, dowDigitsAdjusted);
        });
        if (expressionParts[5] == "L") {
            expressionParts[5] = "6";
        }
        if (expressionParts[3] == "?") {
            expressionParts[3] = "*";
        }
        if (expressionParts[3].indexOf("W") > -1 &&
            (expressionParts[3].indexOf(",") > -1 || expressionParts[3].indexOf("-") > -1)) {
            throw new Error("The 'W' character can be specified only when the day-of-month is a single day, not a range or list of days.");
        }
        var days = {
            SUN: 0,
            MON: 1,
            TUE: 2,
            WED: 3,
            THU: 4,
            FRI: 5,
            SAT: 6
        };
        for (let day in days) {
            expressionParts[5] = expressionParts[5].replace(new RegExp(day, "gi"), days[day].toString());
        }
        var months = {
            JAN: 1,
            FEB: 2,
            MAR: 3,
            APR: 4,
            MAY: 5,
            JUN: 6,
            JUL: 7,
            AUG: 8,
            SEP: 9,
            OCT: 10,
            NOV: 11,
            DEC: 12
        };
        for (let month in months) {
            expressionParts[4] = expressionParts[4].replace(new RegExp(month, "gi"), months[month].toString());
        }
        if (expressionParts[0] == "0") {
            expressionParts[0] = "";
        }
        if (!/\*|\-|\,|\//.test(expressionParts[2]) &&
            (/\*|\//.test(expressionParts[1]) || /\*|\//.test(expressionParts[0]))) {
            expressionParts[2] += `-${expressionParts[2]}`;
        }
        for (let i = 0; i < expressionParts.length; i++) {
            if (expressionParts[i] == "*/1") {
                expressionParts[i] = "*";
            }
            if (expressionParts[i].indexOf("/") > -1 && !/^\*|\-|\,/.test(expressionParts[i])) {
                let stepRangeThrough = null;
                switch (i) {
                    case 4:
                        stepRangeThrough = "12";
                        break;
                    case 5:
                        stepRangeThrough = "6";
                        break;
                    case 6:
                        stepRangeThrough = "9999";
                        break;
                    default:
                        stepRangeThrough = null;
                        break;
                }
                if (stepRangeThrough != null) {
                    let parts = expressionParts[i].split("/");
                    expressionParts[i] = `${parts[0]}-${stepRangeThrough}/${parts[1]}`;
                }
            }
        }
    }
    validate(parsed) {
        this.assertNoInvalidCharacters("DOW", parsed[5]);
        this.assertNoInvalidCharacters("DOM", parsed[3]);
    }
    assertNoInvalidCharacters(partDescription, expression) {
        let invalidChars = expression.match(/[A-KM-VX-Z]+/gi);
        if (invalidChars && invalidChars.length) {
            throw new Error(`${partDescription} part contains invalid values: '${invalidChars.toString()}'`);
        }
    }
}

class ExpressionDescriptor {
    constructor(expression, options) {
        this.expression = expression;
        this.options = options;
        this.expressionParts = new Array(5);
        if (ExpressionDescriptor.locales[options.locale]) {
            this.i18n = ExpressionDescriptor.locales[options.locale];
        }
        else {
            console.warn(`Locale '${options.locale}' could not be found; falling back to 'en'.`);
            this.i18n = ExpressionDescriptor.locales["en"];
        }
        if (options.use24HourTimeFormat === undefined) {
            options.use24HourTimeFormat = this.i18n.use24HourTimeFormatByDefault();
        }
    }
    static toString(expression, { throwExceptionOnParseError = true, verbose = false, dayOfWeekStartIndexZero = true, use24HourTimeFormat, locale = "en" } = {}) {
        let options = {
            throwExceptionOnParseError: throwExceptionOnParseError,
            verbose: verbose,
            dayOfWeekStartIndexZero: dayOfWeekStartIndexZero,
            use24HourTimeFormat: use24HourTimeFormat,
            locale: locale
        };
        let descripter = new ExpressionDescriptor(expression, options);
        return descripter.getFullDescription();
    }
    static initialize(localesLoader) {
        ExpressionDescriptor.specialCharacters = ["/", "-", ",", "*"];
        localesLoader.load(ExpressionDescriptor.locales);
    }
    getFullDescription() {
        let description = "";
        try {
            let parser = new CronParser(this.expression, this.options.dayOfWeekStartIndexZero);
            this.expressionParts = parser.parse();
            var timeSegment = this.getTimeOfDayDescription();
            var dayOfMonthDesc = this.getDayOfMonthDescription();
            var monthDesc = this.getMonthDescription();
            var dayOfWeekDesc = this.getDayOfWeekDescription();
            var yearDesc = this.getYearDescription();
            description += timeSegment + dayOfMonthDesc + dayOfWeekDesc + monthDesc + yearDesc;
            description = this.transformVerbosity(description, this.options.verbose);
            description = description.charAt(0).toLocaleUpperCase() + description.substr(1);
        }
        catch (ex) {
            if (!this.options.throwExceptionOnParseError) {
                description = this.i18n.anErrorOccuredWhenGeneratingTheExpressionD();
            }
            else {
                throw `${ex}`;
            }
        }
        return description;
    }
    getTimeOfDayDescription() {
        let secondsExpression = this.expressionParts[0];
        let minuteExpression = this.expressionParts[1];
        let hourExpression = this.expressionParts[2];
        let description = "";
        if (!StringUtilities.containsAny(minuteExpression, ExpressionDescriptor.specialCharacters) &&
            !StringUtilities.containsAny(hourExpression, ExpressionDescriptor.specialCharacters) &&
            !StringUtilities.containsAny(secondsExpression, ExpressionDescriptor.specialCharacters)) {
            description += this.i18n.atSpace() + this.formatTime(hourExpression, minuteExpression, secondsExpression);
        }
        else if (!secondsExpression &&
            minuteExpression.indexOf("-") > -1 &&
            !(minuteExpression.indexOf(",") > -1) &&
            !(minuteExpression.indexOf("/") > -1) &&
            !StringUtilities.containsAny(hourExpression, ExpressionDescriptor.specialCharacters)) {
            let minuteParts = minuteExpression.split("-");
            description += StringUtilities.format(this.i18n.everyMinuteBetweenX0AndX1(), this.formatTime(hourExpression, minuteParts[0], ""), this.formatTime(hourExpression, minuteParts[1], ""));
        }
        else if (!secondsExpression &&
            hourExpression.indexOf(",") > -1 &&
            hourExpression.indexOf("-") == -1 &&
            hourExpression.indexOf("/") == -1 &&
            !StringUtilities.containsAny(minuteExpression, ExpressionDescriptor.specialCharacters)) {
            let hourParts = hourExpression.split(",");
            description += this.i18n.at();
            for (let i = 0; i < hourParts.length; i++) {
                description += " ";
                description += this.formatTime(hourParts[i], minuteExpression, "");
                if (i < hourParts.length - 2) {
                    description += ",";
                }
                if (i == hourParts.length - 2) {
                    description += this.i18n.spaceAnd();
                }
            }
        }
        else {
            let secondsDescription = this.getSecondsDescription();
            let minutesDescription = this.getMinutesDescription();
            let hoursDescription = this.getHoursDescription();
            description += secondsDescription;
            if (description.length > 0 && minutesDescription.length > 0) {
                description += ", ";
            }
            description += minutesDescription;
            if (description.length > 0 && hoursDescription.length > 0) {
                description += ", ";
            }
            description += hoursDescription;
        }
        return description;
    }
    getSecondsDescription() {
        let description = this.getSegmentDescription(this.expressionParts[0], this.i18n.everySecond(), s => {
            return s;
        }, s => {
            return StringUtilities.format(this.i18n.everyX0Seconds(), s);
        }, s => {
            return this.i18n.secondsX0ThroughX1PastTheMinute();
        }, s => {
            return s == "0"
                ? ""
                : parseInt(s) < 20
                    ? this.i18n.atX0SecondsPastTheMinute()
                    : this.i18n.atX0SecondsPastTheMinuteGt20() || this.i18n.atX0SecondsPastTheMinute();
        });
        return description;
    }
    getMinutesDescription() {
        const secondsExpression = this.expressionParts[0];
        let description = this.getSegmentDescription(this.expressionParts[1], this.i18n.everyMinute(), s => {
            return s;
        }, s => {
            return StringUtilities.format(this.i18n.everyX0Minutes(), s);
        }, s => {
            return this.i18n.minutesX0ThroughX1PastTheHour();
        }, s => {
            try {
                return s == "0" && secondsExpression == ""
                    ? ""
                    : parseInt(s) < 20
                        ? this.i18n.atX0MinutesPastTheHour()
                        : this.i18n.atX0MinutesPastTheHourGt20() || this.i18n.atX0MinutesPastTheHour();
            }
            catch (e) {
                return this.i18n.atX0MinutesPastTheHour();
            }
        });
        return description;
    }
    getHoursDescription() {
        let expression = this.expressionParts[2];
        let description = this.getSegmentDescription(expression, this.i18n.everyHour(), s => {
            return this.formatTime(s, "0", "");
        }, s => {
            return StringUtilities.format(this.i18n.everyX0Hours(), s);
        }, s => {
            return this.i18n.betweenX0AndX1();
        }, s => {
            return this.i18n.atX0();
        });
        return description;
    }
    getDayOfWeekDescription() {
        var daysOfWeekNames = this.i18n.daysOfTheWeek();
        let description = null;
        if (this.expressionParts[5] == "*") {
            description = "";
        }
        else {
            description = this.getSegmentDescription(this.expressionParts[5], this.i18n.commaEveryDay(), s => {
                let exp = s;
                if (s.indexOf("#") > -1) {
                    exp = s.substr(0, s.indexOf("#"));
                }
                else if (s.indexOf("L") > -1) {
                    exp = exp.replace("L", "");
                }
                return daysOfWeekNames[parseInt(exp)];
            }, s => {
                return StringUtilities.format(this.i18n.commaEveryX0DaysOfTheWeek(), s);
            }, s => {
                return this.i18n.commaX0ThroughX1();
            }, s => {
                let format = null;
                if (s.indexOf("#") > -1) {
                    let dayOfWeekOfMonthNumber = s.substring(s.indexOf("#") + 1);
                    let dayOfWeekOfMonthDescription = null;
                    switch (dayOfWeekOfMonthNumber) {
                        case "1":
                            dayOfWeekOfMonthDescription = this.i18n.first();
                            break;
                        case "2":
                            dayOfWeekOfMonthDescription = this.i18n.second();
                            break;
                        case "3":
                            dayOfWeekOfMonthDescription = this.i18n.third();
                            break;
                        case "4":
                            dayOfWeekOfMonthDescription = this.i18n.fourth();
                            break;
                        case "5":
                            dayOfWeekOfMonthDescription = this.i18n.fifth();
                            break;
                    }
                    format = this.i18n.commaOnThe() + dayOfWeekOfMonthDescription + this.i18n.spaceX0OfTheMonth();
                }
                else if (s.indexOf("L") > -1) {
                    format = this.i18n.commaOnTheLastX0OfTheMonth();
                }
                else {
                    const domSpecified = this.expressionParts[3] != "*";
                    format = domSpecified ? this.i18n.commaAndOnX0() : this.i18n.commaOnlyOnX0();
                }
                return format;
            });
        }
        return description;
    }
    getMonthDescription() {
        var monthNames = this.i18n.monthsOfTheYear();
        let description = this.getSegmentDescription(this.expressionParts[4], "", s => {
            return monthNames[parseInt(s) - 1];
        }, s => {
            return StringUtilities.format(this.i18n.commaEveryX0Months(), s);
        }, s => {
            return this.i18n.commaMonthX0ThroughMonthX1() || this.i18n.commaX0ThroughX1();
        }, s => {
            return this.i18n.commaOnlyInX0();
        });
        return description;
    }
    getDayOfMonthDescription() {
        let description = null;
        let expression = this.expressionParts[3];
        switch (expression) {
            case "L":
                description = this.i18n.commaOnTheLastDayOfTheMonth();
                break;
            case "WL":
            case "LW":
                description = this.i18n.commaOnTheLastWeekdayOfTheMonth();
                break;
            default:
                let weekDayNumberMatches = expression.match(/(\d{1,2}W)|(W\d{1,2})/);
                if (weekDayNumberMatches) {
                    let dayNumber = parseInt(weekDayNumberMatches[0].replace("W", ""));
                    let dayString = dayNumber == 1
                        ? this.i18n.firstWeekday()
                        : StringUtilities.format(this.i18n.weekdayNearestDayX0(), dayNumber.toString());
                    description = StringUtilities.format(this.i18n.commaOnTheX0OfTheMonth(), dayString);
                    break;
                }
                else {
                    let lastDayOffSetMatches = expression.match(/L-(\d{1,2})/);
                    if (lastDayOffSetMatches) {
                        let offSetDays = lastDayOffSetMatches[1];
                        description = StringUtilities.format(this.i18n.commaDaysBeforeTheLastDayOfTheMonth(), offSetDays);
                        break;
                    }
                    else {
                        description = this.getSegmentDescription(expression, this.i18n.commaEveryDay(), s => {
                            return s == "L" ? this.i18n.lastDay() : s;
                        }, s => {
                            return s == "1" ? this.i18n.commaEveryDay() : this.i18n.commaEveryX0Days();
                        }, s => {
                            return this.i18n.commaBetweenDayX0AndX1OfTheMonth();
                        }, s => {
                            return this.i18n.commaOnDayX0OfTheMonth();
                        });
                    }
                    break;
                }
        }
        return description;
    }
    getYearDescription() {
        let description = this.getSegmentDescription(this.expressionParts[6], "", s => {
            return /^\d+$/.test(s) ? new Date(parseInt(s), 1).getFullYear().toString() : s;
        }, s => {
            return StringUtilities.format(this.i18n.commaEveryX0Years(), s);
        }, s => {
            return this.i18n.commaYearX0ThroughYearX1() || this.i18n.commaX0ThroughX1();
        }, s => {
            return this.i18n.commaOnlyInX0();
        });
        return description;
    }
    getSegmentDescription(expression, allDescription, getSingleItemDescription, getIntervalDescriptionFormat, getBetweenDescriptionFormat, getDescriptionFormat) {
        let description = null;
        if (!expression) {
            description = "";
        }
        else if (expression === "*") {
            description = allDescription;
        }
        else if (!StringUtilities.containsAny(expression, ["/", "-", ","])) {
            description = StringUtilities.format(getDescriptionFormat(expression), getSingleItemDescription(expression));
        }
        else if (expression.indexOf("/") > -1) {
            let segments = expression.split("/");
            description = StringUtilities.format(getIntervalDescriptionFormat(segments[1]), getSingleItemDescription(segments[1]));
            if (segments[0].indexOf("-") > -1) {
                let betweenSegmentDescription = this.generateBetweenSegmentDescription(segments[0], getBetweenDescriptionFormat, getSingleItemDescription);
                if (betweenSegmentDescription.indexOf(", ") != 0) {
                    description += ", ";
                }
                description += betweenSegmentDescription;
            }
            else if (!StringUtilities.containsAny(segments[0], ["*", ","])) {
                let rangeItemDescription = StringUtilities.format(getDescriptionFormat(segments[0]), getSingleItemDescription(segments[0]));
                rangeItemDescription = rangeItemDescription.replace(", ", "");
                description += StringUtilities.format(this.i18n.commaStartingX0(), rangeItemDescription);
            }
        }
        else if (expression.indexOf(",") > -1) {
            let segments = expression.split(",");
            let descriptionContent = "";
            for (let i = 0; i < segments.length; i++) {
                if (i > 0 && segments.length > 2) {
                    descriptionContent += ",";
                    if (i < segments.length - 1) {
                        descriptionContent += " ";
                    }
                }
                if (i > 0 && segments.length > 1 && (i == segments.length - 1 || segments.length == 2)) {
                    descriptionContent += `${this.i18n.spaceAnd()} `;
                }
                if (segments[i].indexOf("-") > -1) {
                    let betweenSegmentDescription = this.generateBetweenSegmentDescription(segments[i], s => {
                        return this.i18n.commaX0ThroughX1();
                    }, getSingleItemDescription);
                    betweenSegmentDescription = betweenSegmentDescription.replace(", ", "");
                    descriptionContent += betweenSegmentDescription;
                }
                else {
                    descriptionContent += getSingleItemDescription(segments[i]);
                }
            }
            description = StringUtilities.format(getDescriptionFormat(expression), descriptionContent);
        }
        else if (expression.indexOf("-") > -1) {
            description = this.generateBetweenSegmentDescription(expression, getBetweenDescriptionFormat, getSingleItemDescription);
        }
        return description;
    }
    generateBetweenSegmentDescription(betweenExpression, getBetweenDescriptionFormat, getSingleItemDescription) {
        let description = "";
        let betweenSegments = betweenExpression.split("-");
        let betweenSegment1Description = getSingleItemDescription(betweenSegments[0]);
        let betweenSegment2Description = getSingleItemDescription(betweenSegments[1]);
        betweenSegment2Description = betweenSegment2Description.replace(":00", ":59");
        let betweenDescriptionFormat = getBetweenDescriptionFormat(betweenExpression);
        description += StringUtilities.format(betweenDescriptionFormat, betweenSegment1Description, betweenSegment2Description);
        return description;
    }
    formatTime(hourExpression, minuteExpression, secondExpression) {
        let hour = parseInt(hourExpression);
        let period = "";
        if (!this.options.use24HourTimeFormat) {
            period = hour >= 12 ? " PM" : " AM";
            if (hour > 12) {
                hour -= 12;
            }
            if (hour === 0) {
                hour = 12;
            }
        }
        let minute = minuteExpression;
        let second = "";
        if (secondExpression) {
            second = `:${("00" + secondExpression).substring(secondExpression.length)}`;
        }
        return `${("00" + hour.toString()).substring(hour.toString().length)}:${("00" + minute.toString()).substring(minute.toString().length)}${second}${period}`;
    }
    transformVerbosity(description, useVerboseFormat) {
        if (!useVerboseFormat) {
            description = description.replace(new RegExp(this.i18n.commaEveryMinute(), "g"), "");
            description = description.replace(new RegExp(this.i18n.commaEveryHour(), "g"), "");
            description = description.replace(new RegExp(this.i18n.commaEveryDay(), "g"), "");
            description = description.replace(/\, ?$/, "");
        }
        return description;
    }
}
ExpressionDescriptor.locales = {};

class en {
    atX0SecondsPastTheMinuteGt20() {
        return null;
    }
    atX0MinutesPastTheHourGt20() {
        return null;
    }
    commaMonthX0ThroughMonthX1() {
        return null;
    }
    commaYearX0ThroughYearX1() {
        return null;
    }
    use24HourTimeFormatByDefault() {
        return false;
    }
    anErrorOccuredWhenGeneratingTheExpressionD() {
        return "An error occured when generating the expression description.  Check the cron expression syntax.";
    }
    everyMinute() {
        return "every minute";
    }
    everyHour() {
        return "every hour";
    }
    atSpace() {
        return "At ";
    }
    everyMinuteBetweenX0AndX1() {
        return "Every minute between %s and %s";
    }
    at() {
        return "At";
    }
    spaceAnd() {
        return " and";
    }
    everySecond() {
        return "every second";
    }
    everyX0Seconds() {
        return "every %s seconds";
    }
    secondsX0ThroughX1PastTheMinute() {
        return "seconds %s through %s past the minute";
    }
    atX0SecondsPastTheMinute() {
        return "at %s seconds past the minute";
    }
    everyX0Minutes() {
        return "every %s minutes";
    }
    minutesX0ThroughX1PastTheHour() {
        return "minutes %s through %s past the hour";
    }
    atX0MinutesPastTheHour() {
        return "at %s minutes past the hour";
    }
    everyX0Hours() {
        return "every %s hours";
    }
    betweenX0AndX1() {
        return "between %s and %s";
    }
    atX0() {
        return "at %s";
    }
    commaEveryDay() {
        return ", every day";
    }
    commaEveryX0DaysOfTheWeek() {
        return ", every %s days of the week";
    }
    commaX0ThroughX1() {
        return ", %s through %s";
    }
    first() {
        return "first";
    }
    second() {
        return "second";
    }
    third() {
        return "third";
    }
    fourth() {
        return "fourth";
    }
    fifth() {
        return "fifth";
    }
    commaOnThe() {
        return ", on the ";
    }
    spaceX0OfTheMonth() {
        return " %s of the month";
    }
    lastDay() {
        return "the last day";
    }
    commaOnTheLastX0OfTheMonth() {
        return ", on the last %s of the month";
    }
    commaOnlyOnX0() {
        return ", only on %s";
    }
    commaAndOnX0() {
        return ", and on %s";
    }
    commaEveryX0Months() {
        return ", every %s months";
    }
    commaOnlyInX0() {
        return ", only in %s";
    }
    commaOnTheLastDayOfTheMonth() {
        return ", on the last day of the month";
    }
    commaOnTheLastWeekdayOfTheMonth() {
        return ", on the last weekday of the month";
    }
    commaDaysBeforeTheLastDayOfTheMonth() {
        return ", %s days before the last day of the month";
    }
    firstWeekday() {
        return "first weekday";
    }
    weekdayNearestDayX0() {
        return "weekday nearest day %s";
    }
    commaOnTheX0OfTheMonth() {
        return ", on the %s of the month";
    }
    commaEveryX0Days() {
        return ", every %s days";
    }
    commaBetweenDayX0AndX1OfTheMonth() {
        return ", between day %s and %s of the month";
    }
    commaOnDayX0OfTheMonth() {
        return ", on day %s of the month";
    }
    commaEveryMinute() {
        return ", every minute";
    }
    commaEveryHour() {
        return ", every hour";
    }
    commaEveryX0Years() {
        return ", every %s years";
    }
    commaStartingX0() {
        return ", starting %s";
    }
    daysOfTheWeek() {
        return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    }
    monthsOfTheYear() {
        return [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];
    }
}

class enLocaleLoader {
    load(availableLocales) {
        availableLocales["en"] = new en();
    }
}

ExpressionDescriptor.initialize(new enLocaleLoader());
let toString = ExpressionDescriptor.toString;

export default ExpressionDescriptor;
export { toString };
