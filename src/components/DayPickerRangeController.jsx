import React from 'react';
import PropTypes from 'prop-types';
import momentPropTypes from 'react-moment-proptypes';
import { forbidExtraProps, nonNegativeInteger } from 'airbnb-prop-types';
import moment from 'moment';
import values from 'object.values';

import { DayPickerPhrases } from '../defaultPhrases';
import getPhrasePropTypes from '../utils/getPhrasePropTypes';

import isTouchDevice from '../utils/isTouchDevice';

import isInclusivelyAfterDay from '../utils/isInclusivelyAfterDay';
import isNextDay from '../utils/isNextDay';
import isSameDay from '../utils/isSameDay';
import isAfterDay from '../utils/isAfterDay';
import isBeforeDay from '../utils/isBeforeDay';

import getVisibleDays from '../utils/getVisibleDays';
import isDayVisible from '../utils/isDayVisible';

import toISODateString from '../utils/toISODateString';
import toISOMonthString from '../utils/toISOMonthString';

import FocusedInputShape from '../shapes/FocusedInputShape';
import ScrollableOrientationShape from '../shapes/ScrollableOrientationShape';

import {
  START_DATE,
  END_DATE,
  HORIZONTAL_ORIENTATION,
  DAY_SIZE,
} from '../../constants';

import DayPicker, { defaultProps as DayPickerDefaultProps } from './DayPicker';

const propTypes = forbidExtraProps({
  startDate: momentPropTypes.momentObj,
  endDate: momentPropTypes.momentObj,
  onDatesChange: PropTypes.func,

  focusedInput: FocusedInputShape,
  onFocusChange: PropTypes.func,
  onClose: PropTypes.func,

  keepOpenOnDateSelect: PropTypes.bool,
  minimumNights: PropTypes.number,
  isOutsideRange: PropTypes.func,
  isDayBlocked: PropTypes.func,
  isDayHighlighted: PropTypes.func,

  // DayPicker props
  renderMonth: PropTypes.func,
  enableOutsideDays: PropTypes.bool,
  numberOfMonths: PropTypes.number,
  orientation: ScrollableOrientationShape,
  withPortal: PropTypes.bool,
  initialVisibleMonth: PropTypes.func,
  hideKeyboardShortcutsPanel: PropTypes.bool,
  daySize: nonNegativeInteger,

  navPrev: PropTypes.node,
  navNext: PropTypes.node,

  onPrevMonthClick: PropTypes.func,
  onNextMonthClick: PropTypes.func,
  onOutsideClick: PropTypes.func,
  renderDay: PropTypes.func,
  renderCalendarInfo: PropTypes.func,

  // accessibility
  onBlur: PropTypes.func,
  isFocused: PropTypes.bool,
  showKeyboardShortcuts: PropTypes.bool,

  // i18n
  monthFormat: PropTypes.string,
  phrases: PropTypes.shape(getPhrasePropTypes(DayPickerPhrases)),

  isRTL: PropTypes.bool,
});

const defaultProps = {
  startDate: undefined, // TODO: use null
  endDate: undefined, // TODO: use null
  onDatesChange() {},

  focusedInput: null,
  onFocusChange() {},
  onClose() {},

  keepOpenOnDateSelect: false,
  minimumNights: 1,
  isOutsideRange() {},
  isDayBlocked() {},
  isDayHighlighted() {},

  // DayPicker props
  renderMonth: null,
  enableOutsideDays: false,
  numberOfMonths: 1,
  orientation: HORIZONTAL_ORIENTATION,
  withPortal: false,
  hideKeyboardShortcutsPanel: false,
  initialVisibleMonth: DayPickerDefaultProps.initialVisibleMonth,
  daySize: DAY_SIZE,

  navPrev: null,
  navNext: null,

  onPrevMonthClick() {},
  onNextMonthClick() {},
  onOutsideClick() {},

  renderDay: null,
  renderCalendarInfo: null,

  // accessibility
  onBlur() {},
  isFocused: false,
  showKeyboardShortcuts: false,

  // i18n
  monthFormat: 'MMMM YYYY',
  phrases: DayPickerPhrases,

  isRTL: false,
};

export default class DayPickerRangeController extends React.Component {
  constructor(props) {
    super(props);

    this.isTouchDevice = isTouchDevice();
    this.today = moment();
    this.modifiers = {
      today: day => this.isToday(day),
      blocked: day => this.isBlocked(day),
      'blocked-calendar': day => props.isDayBlocked(day),
      'blocked-out-of-range': day => props.isOutsideRange(day),
      'highlighted-calendar': day => props.isDayHighlighted(day),
      valid: day => !this.isBlocked(day),
      'selected-start': day => this.isStartDate(day),
      'selected-end': day => this.isEndDate(day),
      'blocked-minimum-nights': day => this.doesNotMeetMinimumNights(day),
      'selected-span': day => this.isInSelectedSpan(day),
      'last-in-range': day => this.isLastInRange(day),
      hovered: day => this.isHovered(day),
      'hovered-span': day => this.isInHoveredSpan(day),
      'after-hovered-start': day => this.isDayAfterHoveredStartDate(day),
    };

    const { currentMonth, visibleDays } = this.getStateForNewMonth(props);

    this.state = {
      hoverDate: null,
      currentMonth,
      phrases: props.phrases,
      visibleDays,
    };

    this.onDayClick = this.onDayClick.bind(this);
    this.onDayMouseEnter = this.onDayMouseEnter.bind(this);
    this.onDayMouseLeave = this.onDayMouseLeave.bind(this);
    this.onPrevMonthClick = this.onPrevMonthClick.bind(this);
    this.onNextMonthClick = this.onNextMonthClick.bind(this);
    this.getFirstFocusableDay = this.getFirstFocusableDay.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const {
      startDate,
      endDate,
      focusedInput,
      minimumNights,
      isOutsideRange,
      isDayBlocked,
      isDayHighlighted,
      phrases,
      initialVisibleMonth,
      numberOfMonths,
      enableOutsideDays,
    } = nextProps;
    let { visibleDays } = this.state;

    if (isOutsideRange !== this.props.isOutsideRange) {
      this.modifiers['blocked-out-of-range'] = day => isOutsideRange(day);
    }

    if (isDayBlocked !== this.props.isDayBlocked) {
      this.modifiers['blocked-calendar'] = day => isDayBlocked(day);
    }

    if (isDayHighlighted !== this.props.isDayHighlighted) {
      this.modifiers['highlighted-calendar'] = day => isDayHighlighted(day);
    }

    const didStartDateChange = startDate !== this.props.startDate;
    const didEndDateChange = endDate !== this.props.endDate;
    const didFocusChange = focusedInput !== this.props.focusedInput;

    if (
      (
        initialVisibleMonth !== this.props.initialVisibleMonth ||
        numberOfMonths !== this.props.numberOfMonths ||
        enableOutsideDays !== this.props.enableOutsideDays
      ) && (
        !this.props.focusedInput &&
        didFocusChange
      )
    ) {
      const newMonthState = this.getStateForNewMonth(nextProps);
      const currentMonth = newMonthState.currentMonth;
      visibleDays = newMonthState.visibleDays;
      this.setState({
        currentMonth,
        visibleDays,
      });
    }

    let modifiers = {};

    if (didStartDateChange) {
      modifiers = this.deleteModifier(modifiers, this.props.startDate, 'selected-start');
      modifiers = this.addModifier(modifiers, startDate, 'selected-start');
    }

    if (didEndDateChange) {
      modifiers = this.deleteModifier(modifiers, this.props.endDate, 'selected-end');
      modifiers = this.addModifier(modifiers, endDate, 'selected-end');
    }

    if (didStartDateChange || didEndDateChange) {
      if (this.props.startDate && this.props.endDate) {
        modifiers = this.deleteModifierFromRange(
          modifiers,
          this.props.startDate,
          this.props.endDate.clone().add(1, 'day'),
          'selected-span',
        );
      }

      if (startDate && endDate) {
        modifiers = this.deleteModifierFromRange(
          modifiers,
          startDate,
          endDate,
          'hovered-span',
        );

        modifiers = this.addModifierToRange(
          modifiers,
          startDate.clone().add(1, 'day'),
          endDate,
          'selected-span',
        );
      }
    }

    if (didStartDateChange && startDate && !endDate) {
      const startSpan = startDate.clone().add(1, 'day');
      const endSpan = startDate.clone().add(minimumNights + 1, 'days');
      modifiers = this.addModifierToRange(modifiers, startSpan, endSpan, 'after-hovered-start');
    }

    if (minimumNights > 0 || minimumNights !== this.props.minimumNights) {
      if (didFocusChange || didStartDateChange) {
        const startSpan = this.props.startDate ? this.props.startDate : this.today;
        modifiers = this.deleteModifierFromRange(
          modifiers,
          startSpan,
          startSpan.clone().add(minimumNights, 'days'),
          'blocked-minimum-nights',
        );
      }

      if (startDate && focusedInput === END_DATE) {
        modifiers = this.addModifierToRange(
          modifiers,
          startDate,
          startDate.clone().add(minimumNights, 'days'),
          'blocked-minimum-nights',
        );
      }
    }

    if (didFocusChange) {
      values(visibleDays).forEach((days) => {
        Object.keys(days).forEach((day) => {
          const momentObj = moment(day);
          if (isDayBlocked(momentObj)) {
            modifiers = this.addModifier(modifiers, momentObj, 'blocked-calendar');
          } else {
            modifiers = this.deleteModifier(modifiers, momentObj, 'blocked-calendar');
          }

          if (isDayHighlighted(momentObj)) {
            modifiers = this.addModifier(modifiers, momentObj, 'highlighted-calendar');
          } else {
            modifiers = this.deleteModifier(modifiers, momentObj, 'highlighted-calendar');
          }
        });
      });
    }

    const today = moment();
    if (!isSameDay(this.today, today)) {
      modifiers = this.deleteModifier(modifiers, this.today, 'today');
      modifiers = this.addModifier(modifiers, today, 'today');
      this.today = today;
    }

    if (Object.keys(modifiers).length > 0) {
      this.setState({
        visibleDays: {
          ...visibleDays,
          ...modifiers,
        },
      });
    }

    if (didFocusChange || phrases !== this.props.phrases) {
      // set the appropriate CalendarDay phrase based on focusedInput
      let chooseAvailableDate = phrases.chooseAvailableDate;
      if (focusedInput === START_DATE) {
        chooseAvailableDate = phrases.chooseAvailableStartDate;
      } else if (focusedInput === END_DATE) {
        chooseAvailableDate = phrases.chooseAvailableEndDate;
      }

      this.setState({
        phrases: {
          ...phrases,
          chooseAvailableDate,
        },
      });
    }
  }

  onDayClick(day, e) {
    const { keepOpenOnDateSelect, minimumNights, onBlur } = this.props;
    if (e) e.preventDefault();
    if (this.isBlocked(day)) return;

    const { focusedInput, onFocusChange, onClose } = this.props;
    let { startDate, endDate } = this.props;

    if (focusedInput === START_DATE) {
      onFocusChange(END_DATE);

      startDate = day;

      if (isInclusivelyAfterDay(day, endDate)) {
        endDate = null;
      }
    } else if (focusedInput === END_DATE) {
      const firstAllowedEndDate = startDate && startDate.clone().add(minimumNights, 'days');

      if (!startDate) {
        endDate = day;
        onFocusChange(START_DATE);
      } else if (isInclusivelyAfterDay(day, firstAllowedEndDate)) {
        endDate = day;
        if (!keepOpenOnDateSelect) {
          onFocusChange(null);
          onClose({ startDate, endDate });
        }
      } else {
        startDate = day;
        endDate = null;
      }
    }

    this.props.onDatesChange({ startDate, endDate });
    onBlur();
  }

  onDayMouseEnter(day) {
    if (this.isTouchDevice) return;
    const { startDate, endDate, focusedInput, minimumNights } = this.props;
    const { hoverDate, visibleDays } = this.state;

    let modifiers = {};
    modifiers = this.deleteModifier(modifiers, hoverDate, 'hovered');
    modifiers = this.addModifier(modifiers, day, 'hovered');

    if (startDate && !endDate && focusedInput === END_DATE) {
      if (isAfterDay(hoverDate, startDate)) {
        const endSpan = hoverDate.clone().add(1, 'day');
        modifiers = this.deleteModifierFromRange(modifiers, startDate, endSpan, 'hovered-span');
      }

      if (!this.isBlocked(day) && isAfterDay(day, startDate)) {
        const endSpan = day.clone().add(1, 'day');
        modifiers = this.addModifierToRange(modifiers, startDate, endSpan, 'hovered-span');
      }
    }

    if (!startDate && endDate && focusedInput === START_DATE) {
      if (isBeforeDay(hoverDate, endDate)) {
        modifiers = this.deleteModifierFromRange(modifiers, hoverDate, endDate, 'hovered-span');
      }

      if (!this.isBlocked(day) && isBeforeDay(day, endDate)) {
        modifiers = this.addModifierToRange(modifiers, day, endDate, 'hovered-span');
      }
    }

    if (startDate) {
      const startSpan = startDate.clone().add(1, 'day');
      const endSpan = startDate.clone().add(minimumNights + 1, 'days');
      modifiers = this.deleteModifierFromRange(modifiers, startSpan, endSpan, 'after-hovered-start');

      if (isSameDay(day, startDate)) {
        const newStartSpan = startDate.clone().add(1, 'day');
        const newEndSpan = startDate.clone().add(minimumNights + 1, 'days');
        modifiers =
          this.addModifierToRange(modifiers, newStartSpan, newEndSpan, 'after-hovered-start');
      }
    }

    this.setState({
      hoverDate: day,
      visibleDays: {
        ...visibleDays,
        ...modifiers,
      },
    });
  }

  onDayMouseLeave(day) {
    const { startDate, endDate, minimumNights } = this.props;
    const { hoverDate, visibleDays } = this.state;
    if (this.isTouchDevice || !hoverDate) return;

    let modifiers = {};
    modifiers = this.deleteModifier(modifiers, hoverDate, 'hovered');

    if (startDate && !endDate && isAfterDay(hoverDate, startDate)) {
      const endSpan = hoverDate.clone().add(1, 'day');
      modifiers = this.deleteModifierFromRange(modifiers, startDate, endSpan, 'hovered-span');
    }

    if (!startDate && endDate && isAfterDay(endDate, hoverDate)) {
      modifiers = this.deleteModifierFromRange(modifiers, hoverDate, endDate, 'hovered-span');
    }

    if (startDate && isSameDay(day, startDate)) {
      const startSpan = startDate.clone().add(1, 'day');
      const endSpan = startDate.clone().add(minimumNights + 1, 'days');
      modifiers = this.deleteModifierFromRange(modifiers, startSpan, endSpan, 'after-hovered-start');
    }

    this.setState({
      hoverDate: null,
      visibleDays: {
        ...visibleDays,
        ...modifiers,
      },
    });
  }

  onPrevMonthClick() {
    const { onPrevMonthClick, numberOfMonths, enableOutsideDays } = this.props;
    const { currentMonth, visibleDays } = this.state;

    const newVisibleDays = {};
    Object.keys(visibleDays).sort().slice(0, numberOfMonths + 1).forEach((month) => {
      newVisibleDays[month] = visibleDays[month];
    });

    const prevMonth = currentMonth.clone().subtract(1, 'months');
    const prevMonthVisibleDays = getVisibleDays(prevMonth, 1, enableOutsideDays);

    this.setState({
      currentMonth: prevMonth,
      visibleDays: {
        ...newVisibleDays,
        ...this.getModifiers(prevMonthVisibleDays),
      },
    });

    onPrevMonthClick();
  }

  onNextMonthClick() {
    const { onNextMonthClick, numberOfMonths, enableOutsideDays } = this.props;
    const { currentMonth, visibleDays } = this.state;

    const newVisibleDays = {};
    Object.keys(visibleDays).sort().slice(1).forEach((month) => {
      newVisibleDays[month] = visibleDays[month];
    });

    const nextMonth = currentMonth.clone().add(numberOfMonths, 'month');
    const nextMonthVisibleDays = getVisibleDays(nextMonth, 1, enableOutsideDays);

    this.setState({
      currentMonth: currentMonth.clone().add(1, 'month'),
      visibleDays: {
        ...newVisibleDays,
        ...this.getModifiers(nextMonthVisibleDays),
      },
    });

    onNextMonthClick();
  }

  getFirstFocusableDay(newMonth) {
    const { startDate, endDate, focusedInput, minimumNights, numberOfMonths } = this.props;

    let focusedDate = newMonth.clone().startOf('month');
    if (focusedInput === START_DATE && startDate) {
      focusedDate = startDate.clone();
    } else if (focusedInput === END_DATE && !endDate && startDate) {
      focusedDate = startDate.clone().add(minimumNights, 'days');
    } else if (focusedInput === END_DATE && endDate) {
      focusedDate = endDate.clone();
    }

    if (this.isBlocked(focusedDate)) {
      const days = [];
      const lastVisibleDay = newMonth.clone().add(numberOfMonths - 1, 'months').endOf('month');
      let currentDay = focusedDate.clone();
      while (!isAfterDay(currentDay, lastVisibleDay)) {
        currentDay = currentDay.clone().add(1, 'day');
        days.push(currentDay);
      }

      const viableDays = days.filter(day => !this.isBlocked(day));

      if (viableDays.length > 0) focusedDate = viableDays[0];
    }

    return focusedDate;
  }

  getModifiers(visibleDays) {
    const modifiers = {};
    Object.keys(visibleDays).forEach((month) => {
      modifiers[month] = {};
      visibleDays[month].forEach((day) => {
        modifiers[month][toISODateString(day)] = this.getModifiersForDay(day);
      });
    });

    return modifiers;
  }

  getModifiersForDay(day) {
    return new Set(Object.keys(this.modifiers).filter(modifier => this.modifiers[modifier](day)));
  }

  getStateForNewMonth(nextProps) {
    const { initialVisibleMonth, numberOfMonths, enableOutsideDays } = nextProps;
    const currentMonth = initialVisibleMonth();
    const visibleDays =
      this.getModifiers(getVisibleDays(currentMonth, numberOfMonths, enableOutsideDays));
    return { currentMonth, visibleDays };
  }

  addModifier(updatedDays, day, modifier) {
    const { numberOfMonths, enableOutsideDays } = this.props;
    const { currentMonth, visibleDays } = this.state;
    if (!day || !isDayVisible(day, currentMonth, numberOfMonths, enableOutsideDays)) {
      return updatedDays;
    }
    let monthIso = toISOMonthString(day);
    let month = updatedDays[monthIso] || visibleDays[monthIso];
    const iso = toISODateString(day);

    if (enableOutsideDays) {
      const startOfMonth = day.clone().startOf('month');
      const endOfMonth = day.clone().endOf('month');
      if (
        isBeforeDay(startOfMonth, currentMonth.clone().startOf('month')) ||
        isAfterDay(endOfMonth, currentMonth.clone().endOf('month'))
      ) {
        monthIso = Object.keys(visibleDays).filter(monthKey => (
          monthKey !== monthIso && Object.keys(visibleDays[monthKey]).indexOf(iso) > -1
        ))[0];
        month = updatedDays[monthIso] || visibleDays[monthIso];
      }
    }


    const modifiers = new Set(month[iso]);
    modifiers.add(modifier);
    return {
      ...updatedDays,
      [monthIso]: {
        ...month,
        [iso]: modifiers,
      },
    };
  }

  addModifierToRange(updatedDays, start, end, modifier) {
    let days = updatedDays;

    let spanStart = start.clone();
    while (isBeforeDay(spanStart, end)) {
      days = this.addModifier(days, spanStart, modifier);
      spanStart = spanStart.clone().add(1, 'day');
    }

    return days;
  }

  deleteModifier(updatedDays, day, modifier) {
    const { numberOfMonths, enableOutsideDays } = this.props;
    const { currentMonth, visibleDays } = this.state;
    if (!day || !isDayVisible(day, currentMonth, numberOfMonths, enableOutsideDays)) {
      return updatedDays;
    }

    let monthIso = toISOMonthString(day);
    let month = updatedDays[monthIso] || visibleDays[monthIso];
    const iso = toISODateString(day);
    if (enableOutsideDays) {
      const startOfMonth = day.clone().startOf('month');
      const endOfMonth = day.clone().endOf('month');
      if (
        isBeforeDay(startOfMonth, currentMonth.clone().startOf('month')) ||
        isAfterDay(endOfMonth, currentMonth.clone().endOf('month'))
      ) {
        monthIso = Object.keys(visibleDays).filter(monthKey => (
          monthKey !== monthIso && Object.keys(visibleDays[monthKey]).indexOf(iso) > -1
        ))[0];
        month = updatedDays[monthIso] || visibleDays[monthIso];
      }
    }

    const modifiers = new Set(month[iso]);
    modifiers.delete(modifier);
    return {
      ...updatedDays,
      [monthIso]: {
        ...month,
        [iso]: modifiers,
      },
    };
  }

  deleteModifierFromRange(updatedDays, start, end, modifier) {
    let days = updatedDays;

    let spanStart = start.clone();
    while (isBeforeDay(spanStart, end)) {
      days = this.deleteModifier(days, spanStart, modifier);
      spanStart = spanStart.clone().add(1, 'day');
    }

    return days;
  }

  doesNotMeetMinimumNights(day) {
    const { startDate, isOutsideRange, focusedInput, minimumNights } = this.props;
    if (focusedInput !== END_DATE) return false;

    if (startDate) {
      const dayDiff = day.diff(startDate.clone().startOf('day').hour(12), 'days');
      return dayDiff < minimumNights && dayDiff >= 0;
    }
    return isOutsideRange(moment(day).subtract(minimumNights, 'days'));
  }

  isDayAfterHoveredStartDate(day) {
    const { startDate, endDate, minimumNights } = this.props;
    const { hoverDate } = this.state || {};
    return !!startDate && !endDate && !this.isBlocked(day) && isNextDay(hoverDate, day) &&
      minimumNights > 0 && isSameDay(hoverDate, startDate);
  }

  isEndDate(day) {
    return isSameDay(day, this.props.endDate);
  }

  isHovered(day) {
    const { hoverDate } = this.state || {};
    return isSameDay(day, hoverDate);
  }

  isInHoveredSpan(day) {
    const { startDate, endDate } = this.props;
    const { hoverDate } = this.state || {};

    const isForwardRange = !!startDate && !endDate &&
      (day.isBetween(startDate, hoverDate) ||
       isSameDay(hoverDate, day));
    const isBackwardRange = !!endDate && !startDate &&
      (day.isBetween(hoverDate, endDate) ||
       isSameDay(hoverDate, day));

    const isValidDayHovered = hoverDate && !this.isBlocked(hoverDate);

    return (isForwardRange || isBackwardRange) && isValidDayHovered;
  }

  isInSelectedSpan(day) {
    const { startDate, endDate } = this.props;
    return day.isBetween(startDate, endDate);
  }

  isLastInRange(day) {
    return this.isInSelectedSpan(day) && isNextDay(day, this.props.endDate);
  }

  isStartDate(day) {
    return isSameDay(day, this.props.startDate);
  }

  isBlocked(day) {
    const { isDayBlocked, isOutsideRange } = this.props;
    return isDayBlocked(day) || isOutsideRange(day) || this.doesNotMeetMinimumNights(day);
  }

  isToday(day) {
    return isSameDay(day, this.today);
  }

  render() {
    const {
      numberOfMonths,
      orientation,
      monthFormat,
      renderMonth,
      navPrev,
      navNext,
      onOutsideClick,
      withPortal,
      enableOutsideDays,
      initialVisibleMonth,
      hideKeyboardShortcutsPanel,
      daySize,
      focusedInput,
      renderDay,
      renderCalendarInfo,
      onBlur,
      isFocused,
      showKeyboardShortcuts,
      isRTL,
    } = this.props;

    const { phrases, visibleDays } = this.state;

    return (
      <DayPicker
        ref={(ref) => { this.dayPicker = ref; }}
        orientation={orientation}
        enableOutsideDays={enableOutsideDays}
        modifiers={visibleDays}
        numberOfMonths={numberOfMonths}
        onDayClick={this.onDayClick}
        onDayMouseEnter={this.onDayMouseEnter}
        onDayMouseLeave={this.onDayMouseLeave}
        onPrevMonthClick={this.onPrevMonthClick}
        onNextMonthClick={this.onNextMonthClick}
        monthFormat={monthFormat}
        renderMonth={renderMonth}
        withPortal={withPortal}
        hidden={!focusedInput}
        initialVisibleMonth={initialVisibleMonth}
        daySize={daySize}
        onOutsideClick={onOutsideClick}
        navPrev={navPrev}
        navNext={navNext}
        renderDay={renderDay}
        renderCalendarInfo={renderCalendarInfo}
        hideKeyboardShortcutsPanel={hideKeyboardShortcutsPanel}
        isFocused={isFocused}
        getFirstFocusableDay={this.getFirstFocusableDay}
        onBlur={onBlur}
        showKeyboardShortcuts={showKeyboardShortcuts}
        phrases={phrases}
        isRTL={isRTL}
      />
    );
  }
}

DayPickerRangeController.propTypes = propTypes;
DayPickerRangeController.defaultProps = defaultProps;
