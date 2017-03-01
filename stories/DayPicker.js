import React from 'react';
import { storiesOf } from '@kadira/storybook';
import moment from 'moment';

import DayPicker from '../src/components/DayPicker';

const today = moment('2017-03-9').startOf('day');
const selectedDay = moment('2017-03-7').startOf('day');
const isValidDate = day => day.startOf('day').isSameOrBefore(today);

storiesOf('DayPicker', module)
  .addWithInfo('default', () => (
    <DayPicker
      numberOfMonths={1}
      date={selectedDay}
      modifiers={{
        'blocked-out-of-range': day => !isValidDate(day),
        selected: day => day.isSame(selectedDay, 'd'),
        today: day => day.isSame(today, 'd'),
      }}
      onDayClick={day => (isValidDate(day) ? console.log('clicked', day) : null)}
    />
  ));
