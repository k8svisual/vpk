<topicKey security/>
<topicBack id="topicNext" link="ownerref"/>
<topicNext id="topicBack" link="storage"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Security (tab)

Security provides a view of the defined role, subject, and bindings for resources in the cluster level or selected namespace.  

From the namespace drop-down select a single namespace.  Once a namespace has been selected press the "__View selected namespace__" button. If there is no selected namespace a warning message is displayed.  

The use of a dashed bounding line is used to group the objects in the selected namespace. Objects outside the dashed bounding line are considered cluster level resources.

Click on any of the displayed objects and the associated resource definition will be displayed.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security.png" width="1024">
</p>

### Security filter

If several binding results will be shown a dialog is shown that allows the filtering of the results to be shown.  Select one or more for the drop-down
and press the "__Filter bindings__" button to view.  Press the __Close__ button to cancel viewing any results.

The results are a graph of the security bindings.  Subjects are shown as a rectangle at the top, bindings are shown as an ellipse in the middle, and 
roles shown as a six-sided object at the bottom of the graph.  Below the Role is a list of the defined rules associated with the Role.



<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security_filter.png">
</p>

### Security legend

The __Legend__ button can be pressed to view example shapes and colors for the display.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_security_filter.png">
</p>

<hr style="border:1px solid #aaaaaa">


