import { Component, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as _ from 'lodash';
import { Subject } from 'rxjs';
import { CoreService } from 'app/core/services/core.service';
import { AlertLevel } from 'app/enums/alert-level.enum';
import helptext from 'app/helptext/system/alert-settings';
import { CoreEvent } from 'app/interfaces/events';
import { Option } from 'app/interfaces/option.interface';
import { FieldSets } from 'app/pages/common/entity/entity-form/classes/field-sets';
import { FieldConfig } from 'app/pages/common/entity/entity-form/models/field-config.interface';
import { FieldSet } from 'app/pages/common/entity/entity-form/models/fieldset.interface';
import { EntityFormService } from 'app/pages/common/entity/entity-form/services/entity-form.service';
import { EntityToolbarComponent } from 'app/pages/common/entity/entity-toolbar/entity-toolbar.component';
import { EntityUtils } from 'app/pages/common/entity/utils';
import { DialogService, WebSocketService } from 'app/services/';
import { AppLoaderService } from 'app/services/app-loader/app-loader.service';
import { T } from 'app/translate-marker';

/**
 * This form is unlike other forms in the app which make use of EntityForm.
 * This component's form config is generated based on a response from the
 * middleware.
 */
@UntilDestroy()
@Component({
  selector: 'app-system-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['../../common/entity/entity-form/entity-form.component.scss'],
  providers: [EntityFormService],
})
export class AlertConfigComponent implements OnInit {
  formEvents: Subject<CoreEvent>;
  protected route_success = ['system', 'alertsettings'];
  protected queryCall: 'alertclasses.config' = 'alertclasses.config';
  protected editCall: 'alertclasses.update' = 'alertclasses.update';
  protected isEntity = true;
  fieldSets: FieldSets;
  fieldConfig: FieldConfig[] = [];
  protected settingOptions: Option[] = [];
  protected warningOptions: Option[] = [
    { label: T('INFO'), value: AlertLevel.Info },
    { label: T('NOTICE'), value: AlertLevel.Notice },
    { label: T('WARNING'), value: AlertLevel.Warning },
    { label: T('ERROR'), value: AlertLevel.Error },
    { label: T('CRITICAL'), value: AlertLevel.Critical },
    { label: T('ALERT'), value: AlertLevel.Alert },
    { label: T('EMERGENCY'), value: AlertLevel.Emergency },
  ];
  formGroup: FormGroup;
  isReady = false;
  protected defaults: any[] = [];

  selectedIndex = 0;

  constructor(
    protected core: CoreService,
    private ws: WebSocketService,
    private entityFormService: EntityFormService,
    protected loader: AppLoaderService,
    public dialog: DialogService,
  ) {}

  ngOnInit(): void {
    this.loader.open();
    this.ws.call('alert.list_policies', []).pipe(untilDestroyed(this)).subscribe(
      (res) => {
        for (let i = 0; i < res.length; i++) {
          let label = res[i];
          if (res[i] === 'IMMEDIATELY') {
            label = res[i] + ' (Default)';
          }
          this.settingOptions.push({ label, value: res[i] });
        }
      },
      (error) => {
        this.loader.close();
        new EntityUtils().handleWSError(this, error, this.dialog);
      },
    );

    const sets: FieldSet[] = [];

    this.ws
      .call('alert.list_categories')
      .toPromise()
      .then((categories) => {
        this.addButtons(categories);
        categories.forEach((category: any) => {
          const config: any[] = [];
          for (let i = 0; i < category.classes.length; i++) {
            const c = category.classes[i];
            const warningOptions = [];
            for (let j = 0; j < this.warningOptions.length; j++) {
              const option = JSON.parse(JSON.stringify(this.warningOptions[j])); // apparently this is the proper way to clone an object
              if (option.value === c.level) {
                option.label = option.label + ' (Default)';
              }
              warningOptions.push(option);
            }
            config.push(
              {
                type: 'select',
                name: c.id + '_level',
                inlineLabel: c.title,
                placeholder: T('Set Warning Level'),
                tooltip: helptext.level_tooltip,
                options: warningOptions,
                value: c.level,
              },
              {
                type: 'select',
                name: c.id + '_policy',
                inlineLabel: ' ',
                placeholder: T('Set Frequency'),
                tooltip: helptext.policy_tooltip,
                options: this.settingOptions,
                value: 'IMMEDIATELY',
              },
            );

            this.defaults.push({ id: c.id, level: c.level, policy: 'IMMEDIATELY' });
          }

          const fieldSet = {
            name: category.title,
            label: true,
            width: '100%',
            config,
          };

          sets.push(fieldSet);
        });

        this.fieldSets = new FieldSets(sets);

        this.fieldConfig = this.fieldSets.configs();
        this.formGroup = this.entityFormService.createFormGroup(this.fieldConfig);

        this.ws.call(this.queryCall).pipe(untilDestroyed(this)).subscribe(
          (res) => {
            this.loader.close();
            for (const k in res.classes) {
              for (const j in res.classes[k]) {
                const prop = k + '_' + j;
                if (this.formGroup.controls[prop]) {
                  this.formGroup.controls[prop].setValue(res.classes[k][j]);
                } else {
                  console.error('Missing prop: ' + prop); // some properties don't exist between both calls?
                }
              }
            }
          },
          (err) => {
            this.loader.close();
            new EntityUtils().handleWSError(this, err, this.dialog);
          },
        );
      })
      .catch((error) => {
        this.loader.close();
        new EntityUtils().handleWSError(this, error, this.dialog);
      });
  }

  addButtons(categories: any[]): void {
    const options: Option[] = [];
    categories.forEach((category, index) => {
      options.push({ label: category.title, value: index });
    });
    this.formEvents = new Subject();
    this.formEvents.pipe(untilDestroyed(this)).subscribe((evt: CoreEvent) => {
      if (evt.data.event_control == 'save') {
        this.onSubmit();
      } else {
        this.selectedIndex = evt.data.category.value;
      }
    });

    // Setup Global Actions
    const actionsConfig = {
      actionType: EntityToolbarComponent,
      actionConfig: {
        target: this.formEvents,
        controls: [
          {
            name: 'save',
            label: 'Save',
            type: 'button',
            color: 'primary',
          },
          {
            name: 'category',
            label: 'Category',
            type: 'menu',
            options,
          },
        ],
      },
    };

    this.core.emit({ name: 'GlobalActions', data: actionsConfig, sender: this });
  }

  onSubmit(): void {
    const payload: any = { classes: {} };

    for (const key in this.formGroup.value) {
      const keyValues = key.split('_');
      const alertClass = keyValues[0];
      const classKey = keyValues[1];
      const def = _.find(this.defaults, { id: alertClass });
      if (def[classKey].toUpperCase() !== this.formGroup.value[key].toUpperCase()) {
        // do not submit defaults in the payload
        if (!payload.classes[alertClass]) {
          payload.classes[alertClass] = {};
        }
        payload.classes[alertClass][classKey] = this.formGroup.value[key];
      }
    }

    this.loader.open();

    this.ws
      .call(this.editCall, [payload])
      .pipe(untilDestroyed(this)).subscribe(
        () => this.dialog.Info(T('Settings saved'), '', '300px', 'info', true),
        (error) => new EntityUtils().handleWSError(this, error, this.dialog),
      )
      .add(() => this.loader.close());
  }
}
