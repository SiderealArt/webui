import {
  Component,
  AfterViewInit,
  Input,
  ViewChild,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { UUID } from 'angular2-uuid';
import { add, sub } from 'date-fns';
import { Subject } from 'rxjs';
import { WidgetComponent } from 'app/core/components/widgets/widget/widget.component';
import { ProductType } from 'app/enums/product-type.enum';
import { CoreEvent } from 'app/interfaces/events';
import { ReportsService } from 'app/pages/reportsdashboard/reports.service';
import { WebSocketService, SystemGeneralService } from 'app/services/';
import { LocaleService } from 'app/services/locale.service';
import { Theme } from 'app/services/theme/theme.service';
import { T } from 'app/translate-marker';
import { LineChartComponent } from '../lineChart/lineChart.component';

interface DateTime {
  dateFormat: string;
  timeFormat: string;
}

export interface TimeData {
  start: number;// Seconds since epoch time
  end?: number;// Seconds since epoch time
  step?: string;
  legend?: string;
}

interface TimeAxisData {
  timespan: string;
  timeformat: string;
  culling: number;
}

export interface Report {
  name: string;
  title: string;
  vertical_label: string;
  identifiers?: string[];
  isRendered?: boolean[];
  stacked: boolean;
  stacked_show_total: boolean;
}

export interface ReportData {
  identifier?: string;
  // units?: string;
  start: number;
  end: number;
  aggregations: any;
  legend: string[];
  name: string;
  step: number;
  data: number[][];
}

@UntilDestroy()
@Component({
  selector: 'report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
})
export class ReportComponent extends WidgetComponent implements AfterViewInit, OnChanges, OnDestroy {
  // Labels
  @Input() localControls?: boolean = true;
  @Input() dateFormat?: DateTime;
  @Input() report: Report;
  @Input() multipathTitle?: string;
  @Input() identifier?: string;
  @Input() retroLogo?: string;
  @ViewChild(LineChartComponent, { static: false }) lineChart: LineChartComponent;

  data: ReportData;
  ready = false;
  product_type = window.localStorage['product_type'] as ProductType;
  private delay = 1000; // delayed report render time

  readonly ProductType = ProductType;

  get reportTitle(): string {
    let trimmed = this.report.title.replace(/[\(\)]/g, '');
    if (this.multipathTitle) {
      trimmed = trimmed.replace(this.identifier, '');
      return trimmed;
    }
    return this.identifier ? trimmed.replace(/{identifier}/, this.identifier) : this.report.title;
  }

  get aggregationKeys(): any {
    return Object.keys(this.data.aggregations);
  }

  legendLabels: Subject<any> = new Subject();
  legendData: any = {};
  subtitle: string = T('% of all cores');
  altTitle = '';
  altSubtitle = '';
  widgetColorCssVar = 'var(--primary)';
  isActive = true;

  currentStartDate: number;// as seconds from Unix Epoch
  currentEndDate: number;// as seconds from Unix Epoch
  timeZoomIndex = 4;

  timezone: string;

  stepForwardDisabled = true;

  private _zoomInDisabled = false;
  get zoomInDisabled(): boolean {
    return this.timeZoomIndex >= (this.zoomLevels.length - 1);
  }
  _zoomOutDisabled = false;
  get zoomOutDisabled(): boolean {
    return this.timeZoomIndex <= 0;
  }

  zoomLevels: TimeAxisData[] = [
    { timespan: '5M', timeformat: "%b '%y", culling: 6 }, // 6 months
    { timespan: '1M', timeformat: 'Week %W', culling: 4 }, // 1 month
    { timespan: '7d', timeformat: '%d %b', culling: 6 }, // 1 week
    { timespan: '24h', timeformat: '%a %H:%M', culling: 4 }, // 24hrs
    { timespan: '60m', timeformat: '%H:%M', culling: 6 }, // 60 minutes
  ];

  // Loader
  loader = false;
  private _dataRcvd = false;
  get dataRcvd(): boolean {
    return this._dataRcvd;
  }
  set dataRcvd(val) {
    this._dataRcvd = val;
    if (val) {
      this.loader = false;
    }
  }

  // Chart Options
  showLegendValues = false;
  chartId = 'chart-' + UUID.UUID();
  chartColors: string[];

  get startTime(): string {
    return this.localeService.formatDateTime(new Date(this.currentStartDate), this.timezone);
  }
  get endTime(): string {
    return this.localeService.formatDateTime(new Date(this.currentEndDate), this.timezone);
  }

  formatTime(stamp: any): string {
    const parsed = Date.parse(stamp);
    const result = this.localeService.formatDateTimeWithNoTz(new Date(parsed));
    return result.toLowerCase() !== 'invalid date' ? result : null;
  }

  constructor(public router: Router,
    public translate: TranslateService,
    private rs: ReportsService,
    private ws: WebSocketService,
    protected localeService: LocaleService, private sysGeneralService: SystemGeneralService) {
    super(translate);

    this.core.register({ observerClass: this, eventName: 'ReportData-' + this.chartId }).pipe(untilDestroyed(this)).subscribe((evt: CoreEvent) => {
      this.data = evt.data;
    });

    this.core.register({ observerClass: this, eventName: 'LegendEvent-' + this.chartId }).pipe(untilDestroyed(this)).subscribe((evt: CoreEvent) => {
      const clone = { ...evt.data };
      clone.xHTML = this.formatTime(evt.data.xHTML);
      this.legendData = clone;
    });

    this.core.register({ observerClass: this, eventName: 'ThemeData' }).pipe(untilDestroyed(this)).subscribe((evt: CoreEvent) => {
      this.chartColors = this.processThemeColors(evt.data);
    });

    this.core.register({ observerClass: this, eventName: 'ThemeChanged' }).pipe(untilDestroyed(this)).subscribe((evt: CoreEvent) => {
      this.chartColors = this.processThemeColors(evt.data);
    });

    this.core.emit({ name: 'ThemeDataRequest', sender: this });

    this.sysGeneralService.getGeneralConfig.pipe(
      untilDestroyed(this),
    ).subscribe((res) => this.timezone = res.timezone);
  }

  ngOnDestroy(): void {
    this.core.unregister({ observerClass: this });
  }

  ngAfterViewInit(): void {
    this.stepForwardDisabled = true;
    const zoom = this.zoomLevels[this.timeZoomIndex];
    const rrdOptions = this.convertTimespan(zoom.timespan);
    this.currentStartDate = rrdOptions.start;
    this.currentEndDate = rrdOptions.end;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.report) {
      if (changes.report.previousValue && this.ready == false) {
        this.setupData(changes);
      } else if (!changes.report.previousValue) {
        setTimeout(() => {
          this.ready = true;
          this.setupData(changes);
        }, this.delay);
      } else if (changes.report.previousValue.title !== changes.report.currentValue.title) {
        this.setupData(changes);
      }
    }
  }

  private setupData(changes: SimpleChanges): void {
    const zoom = this.zoomLevels[this.timeZoomIndex];
    const rrdOptions = this.convertTimespan(zoom.timespan);
    const identifier = changes.report.currentValue.identifiers ? changes.report.currentValue.identifiers[0] : null;
    this.fetchReportData(rrdOptions, changes.report.currentValue, identifier);
  }

  private processThemeColors(theme: Theme): string[] {
    // this.theme = theme;
    const colors: string[] = [];
    theme.accentColors.map((color) => {
      colors.push((theme as any)[color]);
    });
    return colors;
  }

  setChartInteractive(value: boolean): void {
    this.isActive = value;
  }

  timeZoomIn(): void {
    // more detail
    const max = 4;
    if (this.timeZoomIndex == max) { return; }
    this.timeZoomIndex += 1;
    const zoom = this.zoomLevels[this.timeZoomIndex];
    const rrdOptions = this.convertTimespan(zoom.timespan);
    this.currentStartDate = rrdOptions.start;
    this.currentEndDate = rrdOptions.end;

    const identifier = this.report.identifiers ? this.report.identifiers[0] : null;
    this.fetchReportData(rrdOptions, this.report, identifier);
  }

  timeZoomOut(): void {
    // less detail
    const min = Number(0);
    if (this.timeZoomIndex == min) { return; }
    this.timeZoomIndex -= 1;
    const zoom = this.zoomLevels[this.timeZoomIndex];
    const rrdOptions = this.convertTimespan(zoom.timespan);
    this.currentStartDate = rrdOptions.start;
    this.currentEndDate = rrdOptions.end;

    const identifier = this.report.identifiers ? this.report.identifiers[0] : null;
    this.fetchReportData(rrdOptions, this.report, identifier);
  }

  stepBack(): void {
    const zoom = this.zoomLevels[this.timeZoomIndex];
    const rrdOptions = this.convertTimespan(zoom.timespan, 'backward', this.currentStartDate);
    this.currentStartDate = rrdOptions.start;
    this.currentEndDate = rrdOptions.end;

    const identifier = this.report.identifiers ? this.report.identifiers[0] : null;
    this.fetchReportData(rrdOptions, this.report, identifier);
  }

  stepForward(): void {
    const zoom = this.zoomLevels[this.timeZoomIndex];

    const rrdOptions = this.convertTimespan(zoom.timespan, 'forward', this.currentEndDate);
    this.currentStartDate = rrdOptions.start;
    this.currentEndDate = rrdOptions.end;

    const identifier = this.report.identifiers ? this.report.identifiers[0] : null;
    this.fetchReportData(rrdOptions, this.report, identifier);
  }

  getServerTime(): Date {
    const xmlHttp = new XMLHttpRequest();
    xmlHttp.open('HEAD', window.location.origin.toString(), false);
    xmlHttp.setRequestHeader('Content-Type', 'text/html');
    xmlHttp.send('');
    const serverTime = xmlHttp.getResponseHeader('Date');
    const seconds = new Date(serverTime).getTime();
    const secondsToTrim = 60;
    const trimmed = new Date(seconds - (secondsToTrim * 1000));
    return trimmed;
  }

  // Convert timespan to start/end options for RRDTool
  convertTimespan(timespan: any, direction = 'backward', currentDate?: number): TimeData {
    let durationUnit: keyof Duration;
    let value: number;

    const now = this.getServerTime();

    let startDate: Date;
    let endDate: Date;
    if (direction == 'backward' && !currentDate) {
      endDate = now;
    } else if (direction == 'backward' && currentDate) {
      endDate = new Date(currentDate);
    } else if (direction == 'forward' && currentDate) {
      startDate = new Date(currentDate);
    } else {
      throw 'A current date parameter must be specified when stepping forward in time!\n direction specified was ' + direction;
    }

    switch (timespan) {
      case '5M':
        durationUnit = 'months';
        value = 5;
        break;
      case '1M':
        durationUnit = 'months';
        value = 1;
        break;
      case '7d':
        durationUnit = 'days';
        value = 7;
        break;
      case '24h':
        durationUnit = 'hours';
        value = 24;
        break;
      case '60m':
        durationUnit = 'minutes';
        value = 60;
        break;
    }

    if (direction == 'backward') {
      const subOptions: Duration = {};
      subOptions[durationUnit] = value;
      startDate = sub(endDate, subOptions);
    } else if (direction == 'forward') {
      const subOptions: Duration = {};
      subOptions[durationUnit] = value;
      endDate = add(startDate, subOptions);
    }

    // if endDate is in the future, reset with endDate to now
    if (endDate.getTime() >= now.getTime()) {
      endDate = new Date();
      const subOptions: Duration = {};
      subOptions[durationUnit] = value;
      startDate = sub(endDate, subOptions);
      this.stepForwardDisabled = true;
    } else {
      this.stepForwardDisabled = false;
    }

    return {
      start: startDate.getTime(),
      end: endDate.getTime(),
      step: '10',
    };
  }

  fetchReportData(rrdOptions: any, report: Report, identifier?: string): void {
    // Report options
    const params = identifier ? { name: report.name, identifier } : { name: report.name };

    // Time scale options
    const start = Math.floor(rrdOptions.start / 1000);
    const end = Math.floor(rrdOptions.end / 1000);
    const timeFrame = { start, end };

    this.core.emit({
      name: 'ReportDataRequest',
      data: {
        report, params, timeFrame, truncate: this.stepForwardDisabled,
      },
      sender: this,
    });
  }

  // Will be used for back of flip card
  setPreferences(form: NgForm): void {
    const filtered: string[] = [];
    for (const i in form.value) {
      if (form.value[i]) {
        filtered.push(i);
      }
    }
  }
}
