import { Component, OnInit } from '@angular/core';
import { FormGroup, FormArray } from '@angular/forms';
import * as _ from 'lodash';
import { FieldConfig } from 'app/pages/common/entity/entity-form/models/field-config.interface';
import { Field } from 'app/pages/common/entity/entity-form/models/field.interface';
import { EntityFormService } from 'app/pages/common/entity/entity-form/services/entity-form.service';
import { FieldRelationService } from 'app/pages/common/entity/entity-form/services/field-relation.service';

@Component({
  selector: 'entity-form-list',
  templateUrl: './form-list.component.html',
  styleUrls: ['./form-list.component.scss', '../dynamic-field/dynamic-field.scss'],
})
export class FormListComponent implements Field, OnInit {
  config: FieldConfig;
  group: FormGroup;
  fieldShow: string;

  listsFromArray: FormArray;

  constructor(private entityFormService: EntityFormService, protected fieldRelationService: FieldRelationService) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.listsFromArray = this.group.controls[this.config.name] as FormArray;
      if (this.config.addInitialList && this.listsFromArray.length === 0) {
        this.add();
      }
    }, 0);
  }

  add(): void {
    const templateListField = _.cloneDeep(this.config.templateListField);
    const formGroup = this.entityFormService.createFormGroup(templateListField);
    this.listsFromArray.push(formGroup);
    this.config.listFields.push(templateListField);

    templateListField.forEach((subFieldConfig) => {
      this.fieldRelationService.setRelation(subFieldConfig, formGroup);
    });
  }

  delete(id: number): void {
    this.listsFromArray.removeAt(id);
    this.config.listFields.splice(id, 1);
  }
}
