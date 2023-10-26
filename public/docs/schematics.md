<topicKey schematics/>
<topicBack id="topicNext" link="graphicview"/>
<topicNext id="topicBack" link="cluster"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### Workload Schematics

---

Schematic view of deployed workload and associated resources

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/10lPGzn0VCk">
    </iframe>
</div> -->

---

From the namespace drop-down select one or more namespaces.  Once namespace(s) have been selected press the __View Schematic(s)__ button. 

A button for each selected namespace will be displayed.  Press one or more buttons to view the associated schematics for the namespace.  

If the button is yellow the namespace has no deployed and running pods.

##### Schematic view

Mouse over each of the icons in the schematic for summary information for associated resources.  

Click the icon to view the resource definition.  If more than one resource is defined for the icon a selection dialog is shown to allow selecting the individual resources definitions.

For resource kind _Secret_ there will be a screen allowing the ability to view the Secret yaml or the base64 information decoded.

The light gray bar at the top of the schematic represents namespace level resources for the workload.  The dark gray bar on the righthand side of the schematic has cluster level resources.

---
