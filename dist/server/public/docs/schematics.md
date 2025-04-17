<topicKey schematics/>
<topicBack id="topicNext" link="storage"/>
<topicNext id="topicBack" link="cluster"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Workload Schematic (tab)

Workload Schematics tab is a view of a deployed Pod and the associated resources.

From the namespace drop-down select one or more namespaces.  Once namespace(s) have been selected press the __View Schematic(s)__ button. 

A button for each selected namespace will be displayed.  Press one or more buttons to view the associated schematics for the namespace.  

If the button is yellow the namespace has no deployed and running pods.

---

### Workload Schematics view

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics.png" width="1024">
</p>

---

Mouse over each of the icons in the schematic for summary information for associated resources.  Example of the pop-up when scrolling over the 'Secrets' icon.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics_rollover.png">
</p>

Click the icon to view the resource definition.  If more than one resources is defined for the icon a selection dialog is shown to allow selecting the individual resource definition.

For resource kind _Secret_ there will be a screen allowing the ability to view the Secret yaml or the base64 information in a decoded format.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics_resources.png">
</p>

When the 'Decode' button is pressed for a Secret the data is decoded and displayed.  Example:

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics_decode.png" width="1024">
</p>

When a resource button is pressed the definition of the source of the resource is shown in a view only modal screen.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics_source.png">
</p>

The light gray bar at the top of the schematic represents namespace level resources for the workload.  The dark gray bar on the righthand side of the schematic has cluster level resources.

When the 'Namespace' icon in the light gray bar is pressed a scrollable list of all resources defined in the namespace is shown.  Click any of the lines of data to view the associated resource definition.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_workloadschematics_namespace.png">
</p>

<hr style="border:1px solid #aaaaaa">


