import moment from 'moment';
import { configure, addDecorator, setAddon } from '@kadira/storybook';
import infoAddon from '@kadira/react-storybook-addon-info';
import '../css/styles.scss';

addDecorator((story) => {
  moment.locale('de');
  return (story());
});

function loadStories() {
  require('../stories/DayPicker');
}

setAddon(infoAddon);

configure(loadStories, module);
